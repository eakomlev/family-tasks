import type { FastifyInstance } from 'fastify'
import type { PoolClient } from 'pg'
import { isAdminEmail } from './admin.js'
import {
  authenticate,
  bearerToken,
  checkEmailCode,
  CODE_TTL,
  createSession,
  discardEmailCode,
  issueEmailCode,
  normalizeEmail,
  type Purpose,
} from './auth.js'
import { familyCode, hashToken, inviteCode } from './codes.js'
import { pool } from './db.js'
import { coinBalance } from './coins.js'
import { mailBudgetExhausted } from './outbox/budget.js'
import { enqueue, PRIORITY, queueEnabled } from './outbox/index.js'
import { closeSession, publish } from './realtime.js'

const INVITE_TTL_DAYS = 7
const UNIQUE_VIOLATION = '23505'

type Role = 'mama' | 'papa' | 'child'

// эндпоинты, где можно подбирать коды, ограничиваем строже общего лимита
const strictLimit = { rateLimit: { max: 10, timeWindow: '1 minute' } }
// открытые маршруты (вход, регистрация, приглашения): без токена, но с жёстким лимитом
const publicStrict = { ...strictLimit, public: true }

const nameSchema = { type: 'string', minLength: 1, maxLength: 40, pattern: '\\S' } as const
const emailSchema = { type: 'string', format: 'email', maxLength: 254 } as const
const codeSchema = { type: 'string', pattern: '^\\d{6}$' } as const

const emailCodeSchema = {
  body: {
    type: 'object',
    required: ['email', 'purpose'],
    additionalProperties: false,
    properties: { email: emailSchema, purpose: { enum: ['signup', 'login'] } },
  },
}

const createFamilySchema = {
  body: {
    type: 'object',
    required: ['role', 'name', 'email', 'code'],
    additionalProperties: false,
    properties: {
      role: { enum: ['mama', 'papa'] },
      name: nameSchema,
      email: emailSchema,
      code: codeSchema,
    },
  },
}

const joinSchema = {
  body: {
    type: 'object',
    required: ['role', 'name', 'email', 'code'],
    additionalProperties: false,
    properties: {
      role: { enum: ['mama', 'papa', 'child'] },
      name: nameSchema,
      email: emailSchema,
      code: codeSchema,
    },
  },
}

// фото приходит как data URL уже сжатым клиентом; сервер лишь ограничивает тип и размер
const avatarSchema = {
  type: ['string', 'null'],
  maxLength: 70000,
  pattern: '^data:image/(jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$',
} as const

// дата рождения приходит строкой YYYY-MM-DD (без времени и часовых поясов), null очищает
const birthDateSchema = { type: ['string', 'null'], pattern: '^\\d{4}-\\d{2}-\\d{2}$' } as const

const MIN_BIRTH_DATE = '1900-01-01'

// реальная дата, не раньше 1900 и не из будущего (с запасом в сутки на часовые пояса)
function isValidBirthDate(value: string): boolean {
  const parsed = new Date(`${value}T00:00:00Z`)
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) return false
  const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10)
  return value >= MIN_BIRTH_DATE && value <= tomorrow
}

const updateProfileSchema = {
  body: {
    type: 'object',
    additionalProperties: false,
    minProperties: 1,
    properties: { name: nameSchema, avatar: avatarSchema, birthDate: birthDateSchema },
  },
}

const loginSchema = {
  body: {
    type: 'object',
    required: ['email', 'code'],
    additionalProperties: false,
    properties: {
      email: emailSchema,
      code: codeSchema,
      memberId: { type: 'string', format: 'uuid' },
    },
  },
}

interface SignupBody {
  role: Role
  name: string
  email: string
  code: string
}

async function insertMember(
  db: PoolClient,
  familyId: string,
  body: SignupBody,
  email: string,
  isOwner: boolean,
) {
  const name = body.name.trim()
  const { rows } = await db.query(
    `insert into members (family_id, name, email, role, is_owner)
     values ($1, $2, $3, $4, $5) returning id`,
    [familyId, name, email, body.role, isOwner],
  )
  const id = rows[0].id as string
  const token = await createSession(db, id)
  return { id, name, role: body.role, isOwner, token }
}

async function issueInvite(db: Pick<PoolClient, 'query'>, familyId: string) {
  // новая ссылка заменяет старые: так владелец может отозвать утёкшее приглашение
  await db.query('delete from invites where family_id = $1', [familyId])
  const { rows } = await db.query(
    `insert into invites (family_id, code, expires_at)
     values ($1, $2, now() + make_interval(days => $3)) returning code, expires_at`,
    [familyId, inviteCode(), INVITE_TTL_DAYS],
  )
  return { code: rows[0].code as string, expiresAt: rows[0].expires_at as string }
}

function constraintOf(err: unknown): string | undefined {
  const e = err as { code?: string; constraint?: string }
  return e.code === UNIQUE_VIOLATION ? e.constraint : undefined
}

export async function routes(app: FastifyInstance) {
  app.get('/api/health', { config: { public: true } }, async (_req, reply) => {
    try {
      await pool.query('select 1')
      return { status: 'ok' }
    } catch (err) {
      app.log.error(err)
      return reply.code(503).send({ status: 'db_unavailable' })
    }
  })

  // отправка кода на почту. Ответ не зависит от того, известен ли email, чтобы адреса нельзя было перебирать
  app.post<{ Body: { email: string; purpose: Purpose } }>(
    '/api/email-codes',
    { schema: emailCodeSchema, config: publicStrict },
    async (req, reply) => {
      const email = normalizeEmail(req.body.email)
      const { purpose } = req.body

      // Очередь: письма отправляет notifier в пределах дневного бюджета. Если он исчерпан, код не дойдёт до истечения
      // (10 минут), поэтому честно отказываем сразу. Проверка первая и не зависит от адреса, так что ответ ничего
      // не раскрывает, а код и пауза «раз в минуту» не создаются: после освобождения бюджета можно сразу повторить.
      if (queueEnabled() && (await mailBudgetExhausted(pool))) return reply.code(503).send({ error: 'mail_busy' })

      const code = await issueEmailCode(email, purpose)
      if (!code) return reply.code(429).send({ error: 'too_soon' })

      if (purpose === 'login') {
        const known = await pool.query('select 1 from members where email = $1 limit 1', [email])
        if (!known.rows[0]) return reply.code(204).send()
      }

      try {
        await enqueue(pool, { channel: 'email', priority: PRIORITY.code, payload: { v: 1, kind: 'code', to: email, code, ttlMinutes: CODE_TTL } })
      } catch (err) {
        app.log.error(err, 'failed to send email code')
        // при входе тоже молчим, иначе ошибка выдала бы, что email известен
        if (purpose === 'signup') {
          await discardEmailCode(pool, email, purpose)
          return reply.code(502).send({ error: 'mail_failed' })
        }
      }
      return reply.code(204).send()
    },
  )

  // создание семьи: семья + владелец + первое приглашение
  app.post<{ Body: SignupBody }>(
    '/api/families',
    { schema: createFamilySchema, config: publicStrict },
    async (req, reply) => {
      const email = normalizeEmail(req.body.email)
      if (!(await checkEmailCode(email, 'signup', req.body.code))) {
        return reply.code(400).send({ error: 'invalid_code' })
      }

      const db = await pool.connect()
      try {
        await db.query('begin')

        let family: { id: string; code: string } | undefined
        while (!family) {
          const code = familyCode()
          try {
            await db.query('savepoint code_try')
            const { rows } = await db.query(
              'insert into families (code) values ($1) returning id',
              [code],
            )
            family = { id: rows[0].id, code }
          } catch (err) {
            if (!constraintOf(err)) throw err
            await db.query('rollback to savepoint code_try')
          }
        }

        const member = await insertMember(db, family.id, req.body, email, true)
        const invite = await issueInvite(db, family.id)
        await discardEmailCode(db, email, 'signup')
        await db.query('commit')

        return reply.code(201).send({ family: { code: family.code }, member, invite })
      } catch (err) {
        await db.query('rollback').catch(() => {})
        throw err
      } finally {
        db.release()
      }
    },
  )

  // проверка приглашения перед показом выбора роли
  app.get<{ Params: { code: string } }>('/api/invites/:code', { config: publicStrict }, async (req, reply) => {
    const { rows } = await pool.query('select expires_at from invites where code = $1', [
      req.params.code,
    ])
    if (!rows[0]) return reply.code(404).send({ error: 'invite_not_found' })
    if (new Date(rows[0].expires_at) < new Date()) {
      return reply.code(410).send({ error: 'invite_expired' })
    }
    return { expiresAt: rows[0].expires_at }
  })

  app.post<{ Params: { code: string }; Body: SignupBody }>(
    '/api/invites/:code/join',
    { schema: joinSchema, config: publicStrict },
    async (req, reply) => {
      const { rows } = await pool.query(
        `select i.family_id, i.expires_at, f.code as family_code
         from invites i join families f on f.id = i.family_id where i.code = $1`,
        [req.params.code],
      )
      const invite = rows[0]
      if (!invite) return reply.code(404).send({ error: 'invite_not_found' })
      if (new Date(invite.expires_at) < new Date()) {
        return reply.code(410).send({ error: 'invite_expired' })
      }

      const email = normalizeEmail(req.body.email)
      if (!(await checkEmailCode(email, 'signup', req.body.code))) {
        return reply.code(400).send({ error: 'invalid_code' })
      }

      const db = await pool.connect()
      try {
        await db.query('begin')
        const member = await insertMember(db, invite.family_id, req.body, email, false)
        await discardEmailCode(db, email, 'signup')
        await db.query('commit')
        publish(invite.family_id, { type: 'members' })
        return reply.code(201).send({ family: { code: invite.family_code }, member })
      } catch (err) {
        await db.query('rollback').catch(() => {})
        const constraint = constraintOf(err)
        if (constraint === 'members_family_name_idx') return reply.code(409).send({ error: 'name_taken' })
        if (constraint === 'members_family_email_idx') return reply.code(409).send({ error: 'email_taken' })
        throw err
      } finally {
        db.release()
      }
    },
  )

  // вход по email и коду; если email есть в нескольких семьях, клиент должен выбрать участника
  app.post<{ Body: { email: string; code: string; memberId?: string } }>(
    '/api/auth/login',
    { schema: loginSchema, config: publicStrict },
    async (req, reply) => {
      const email = normalizeEmail(req.body.email)
      if (!(await checkEmailCode(email, 'login', req.body.code))) {
        return reply.code(401).send({ error: 'invalid_code' })
      }

      const { rows: candidates } = await pool.query(
        `select m.id, m.name, m.role, m.is_owner as "isOwner", f.code as "familyCode",
                (select array_agg(o.name order by o.created_at) from members o
                 where o.family_id = m.family_id) as "familyMembers"
         from members m join families f on f.id = m.family_id
         where m.email = $1 order by m.created_at`,
        [email],
      )
      if (candidates.length === 0) return reply.code(401).send({ error: 'invalid_code' })

      let chosen = candidates[0]
      if (req.body.memberId) {
        chosen = candidates.find((c) => c.id === req.body.memberId)
        if (!chosen) return reply.code(400).send({ error: 'member_not_found' })
      } else if (candidates.length > 1) {
        // код пока не сжигаем: он понадобится для второго запроса с выбранным участником
        return reply.code(409).send({
          error: 'choose_member',
          options: candidates.map(({ id, name, role, familyCode, familyMembers }) => ({
            id,
            name,
            role,
            familyCode,
            familyMembers,
          })),
        })
      }

      const db = await pool.connect()
      try {
        await db.query('begin')
        const token = await createSession(db, chosen.id)
        await discardEmailCode(db, email, 'login')
        await db.query('commit')
        return reply.code(201).send({
          family: { code: chosen.familyCode },
          member: { id: chosen.id, name: chosen.name, role: chosen.role, isOwner: chosen.isOwner, token },
        })
      } catch (err) {
        await db.query('rollback').catch(() => {})
        throw err
      } finally {
        db.release()
      }
    },
  )

  // выход: отзываем сессию этого устройства. Помечен открытым, чтобы выход с уже истёкшим токеном тоже проходил (идемпотентно); без токена 401 отдаёт сам обработчик
  app.delete('/api/session', { config: { public: true } }, async (req, reply) => {
    const token = bearerToken(req)
    if (!token) return reply.code(401).send({ error: 'unauthorized' })
    await pool.query('delete from sessions where token_hash = $1', [hashToken(token)])
    closeSession(token)
    return reply.code(204).send()
  })

  // действующее приглашение семьи (для владельца)
  app.get('/api/invite', async (req, reply) => {
    const me = await authenticate(req)
    if (!me) return reply.code(401).send({ error: 'unauthorized' })
    if (!me.is_owner) return reply.code(403).send({ error: 'forbidden' })
    const { rows } = await pool.query(
      `select code, expires_at as "expiresAt" from invites
       where family_id = $1 and expires_at > now() order by created_at desc limit 1`,
      [me.family_id],
    )
    if (!rows[0]) return reply.code(404).send({ error: 'no_active_invite' })
    return rows[0]
  })

  app.post('/api/invite', async (req, reply) => {
    const me = await authenticate(req)
    if (!me) return reply.code(401).send({ error: 'unauthorized' })
    if (!me.is_owner) return reply.code(403).send({ error: 'forbidden' })
    return reply.code(201).send(await issueInvite(pool, me.family_id))
  })

  // текущий участник и состав семьи
  app.get('/api/me', async (req, reply) => {
    const me = await authenticate(req)
    if (!me) return reply.code(401).send({ error: 'unauthorized' })
    const { rows: members } = await pool.query(
      `select id, name, role, is_owner as "isOwner", avatar,
              to_char(birth_date, 'YYYY-MM-DD') as "birthDate",
              case when role = 'child' and mood is not null then json_build_object('value', mood, 'at', mood_at) end as mood
       from members where family_id = $1 order by created_at`,
      [me.family_id],
    )
    return {
      member: {
        id: me.id,
        name: me.name,
        role: me.role,
        isOwner: me.is_owner,
        email: me.email,
        // раздел «Сервис» (статистика) только у администраторов из ADMIN_EMAILS
        isAdmin: isAdminEmail(me.email),
        avatar: me.avatar,
        birthDate: me.birth_date,
        mood: members.find((m) => m.id === me.id)?.mood ?? null,
        // монеты есть только у детей и только свои: у остальных поля нет
        ...(me.role === 'child' ? { coins: await coinBalance(pool, me.id) } : {}),
      },
      family: { code: me.family_code },
      members,
    }
  })

  // Настроение на сегодня: только ребёнок и только своё. Клиент показывает его, пока оно «сегодняшнее» (по mood_at).
  app.put<{ Body: { mood: number } }>(
    '/api/me/mood',
    {
      schema: {
        body: {
          type: 'object',
          required: ['mood'],
          additionalProperties: false,
          properties: { mood: { type: 'integer', minimum: 1, maximum: 5 } },
        },
      },
    },
    async (req, reply) => {
      const me = await authenticate(req)
      if (!me) return reply.code(401).send({ error: 'unauthorized' })
      if (me.role !== 'child') return reply.code(403).send({ error: 'children_only' })
      const { rows } = await pool.query(`update members set mood = $2, mood_at = now() where id = $1 returning mood as value, mood_at as at`, [me.id, req.body.mood])
      publish(me.family_id, { type: 'members' })
      return { mood: rows[0] }
    },
  )

  // изменение своего профиля: имя и/или фото (null удаляет фото). Email менять нельзя
  app.patch<{ Body: { name?: string; avatar?: string | null; birthDate?: string | null } }>(
    '/api/me',
    { schema: updateProfileSchema },
    async (req, reply) => {
      const me = await authenticate(req)
      if (!me) return reply.code(401).send({ error: 'unauthorized' })

      const sets: string[] = []
      const values: unknown[] = []
      if (req.body.name !== undefined) {
        values.push(req.body.name.trim())
        sets.push(`name = $${values.length}`)
      }
      if (req.body.avatar !== undefined) {
        values.push(req.body.avatar)
        sets.push(`avatar = $${values.length}`)
      }
      if (req.body.birthDate !== undefined) {
        if (req.body.birthDate !== null && !isValidBirthDate(req.body.birthDate)) {
          return reply.code(400).send({ error: 'invalid_birth_date' })
        }
        values.push(req.body.birthDate)
        sets.push(`birth_date = $${values.length}`)
      }
      // Fastify вырезает неизвестные поля уже после проверки minProperties, поэтому проверяем ещё раз
      if (sets.length === 0) return reply.code(400).send({ error: 'nothing_to_update' })
      values.push(me.id)

      try {
        const { rows } = await pool.query(
          `update members set ${sets.join(', ')} where id = $${values.length}
           returning id, name, role, is_owner as "isOwner", email, avatar,
                     to_char(birth_date, 'YYYY-MM-DD') as "birthDate"`,
          values,
        )
        publish(me.family_id, { type: 'members' })
        return { member: rows[0] }
      } catch (err) {
        if (constraintOf(err) === 'members_family_name_idx') {
          return reply.code(409).send({ error: 'name_taken' })
        }
        throw err
      }
    },
  )
}
