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
  type Purpose,
} from './auth.js'
import { familyCode, hashToken, inviteCode } from './codes.js'
import { pool } from './db.js'
import type { CaptchaVerifier } from './captcha.js'
import { coinBalance } from './coins.js'
import { parseContact, type Contact } from './contact.js'
import { CONSENT_VERSION } from './consent.js'
import { mailBudgetExhausted, smsBudgetExhausted } from './outbox/budget.js'
import { enqueue, PRIORITY } from './outbox/index.js'
import { closeSession, publish } from './realtime.js'
import { MAX_FAMILY_MEMBERS, ROLES, type Role } from './roles.js'

const INVITE_TTL_DAYS = 7
const UNIQUE_VIOLATION = '23505'


// эндпоинты, где можно подбирать коды, ограничиваем строже общего лимита
const strictLimit = { rateLimit: { max: 10, timeWindow: '1 minute' } }
// открытые маршруты (вход, регистрация, приглашения): без токена, но с жёстким лимитом
const publicStrict = { ...strictLimit, public: true }

const nameSchema = { type: 'string', minLength: 1, maxLength: 40, pattern: '\\S' } as const
const emailSchema = { type: 'string', format: 'email', maxLength: 254 } as const
const codeSchema = { type: 'string', pattern: '^\\d{6}$' } as const
// телефон приходит как ввёл человек («8 911 …», «+7 (911) …»), нормализует сервер; неверный номер это 400 invalid_phone
const phoneSchema = { type: 'string', minLength: 5, maxLength: 30 } as const
// способ связи: ровно один из двух, email или phone (проверяет parseContact)
const anyContact = { anyOf: [{ required: ['email'] }, { required: ['phone'] }] } as const

const emailCodeSchema = {
  body: {
    type: 'object',
    required: ['purpose'],
    ...anyContact,
    additionalProperties: false,
    properties: { email: emailSchema, phone: phoneSchema, purpose: { enum: ['signup', 'login'] }, captchaToken: { type: 'string', maxLength: 4096 } },
  },
}

const createFamilySchema = {
  body: {
    type: 'object',
    required: ['role', 'name', 'code'],
    ...anyContact,
    additionalProperties: false,
    properties: {
      role: { enum: ['mama', 'papa'] },
      name: nameSchema,
      email: emailSchema,
      phone: phoneSchema,
      // согласие на обработку персональных данных: без true регистрация отклоняется (400 consent_required)
      consent: { type: 'boolean' },
      code: codeSchema,
    },
  },
}

const joinSchema = {
  body: {
    type: 'object',
    required: ['role', 'name', 'code'],
    ...anyContact,
    additionalProperties: false,
    properties: {
      role: { enum: ROLES },
      name: nameSchema,
      email: emailSchema,
      phone: phoneSchema,
      // согласие на обработку персональных данных: без true регистрация отклоняется (400 consent_required)
      consent: { type: 'boolean' },
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
    required: ['code'],
    ...anyContact,
    additionalProperties: false,
    properties: {
      email: emailSchema,
      phone: phoneSchema,
      // согласие на обработку персональных данных: без true регистрация отклоняется (400 consent_required)
      consent: { type: 'boolean' },
      code: codeSchema,
      memberId: { type: 'string', format: 'uuid' },
    },
  },
}

interface SignupBody {
  role: Role
  name: string
  email?: string
  phone?: string
  consent?: boolean
  code: string
}

async function insertMember(
  db: PoolClient,
  familyId: string,
  body: SignupBody,
  contact: Contact,
  isOwner: boolean,
) {
  const name = body.name.trim()
  // человек начинает с нуля: прежняя запись без семьи с этим контактом не нужна (иначе у контакта было бы две записи)
  await db.query(`delete from members where family_id is null and ${contact.column} = $1`, [contact.value])
  const { rows } = await db.query(
    `insert into members (family_id, name, email, phone, role, is_owner, consent_version, consent_at)
     values ($1, $2, $3, $4, $5, $6, $7, now()) returning id`,
    [familyId, name, contact.kind === 'email' ? contact.value : null, contact.kind === 'phone' ? contact.value : null, body.role, isOwner, CONSENT_VERSION],
  )
  const id = rows[0].id as string
  const token = await createSession(db, id)
  return { id, name, role: body.role, isOwner, token }
}

// новая семья с неповторяющимся кодом
async function insertFamily(db: PoolClient): Promise<{ id: string; code: string }> {
  for (;;) {
    const code = familyCode()
    try {
      await db.query('savepoint code_try')
      const { rows } = await db.query('insert into families (code) values ($1) returning id', [code])
      return { id: rows[0].id as string, code }
    } catch (err) {
      if (!constraintOf(err)) throw err
      await db.query('rollback to savepoint code_try')
    }
  }
}

export async function issueInvite(db: Pick<PoolClient, 'query'>, familyId: string) {
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

export async function routes(app: FastifyInstance, { captcha }: { captcha: CaptchaVerifier | null }) {
  // ключ клиента для виджета капчи; пусто: капча выключена и токен не нужен
  app.get('/api/captcha/config', { config: { public: true } }, async () => ({ siteKey: captcha?.siteKey ?? null }))

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
  // Работает и для телефона: тело с phone вместо email, код приходит SMS.
  app.post<{ Body: { email?: string; phone?: string; purpose: Purpose; captchaToken?: string } }>(
    '/api/email-codes',
    { schema: emailCodeSchema, config: publicStrict },
    async (req, reply) => {
      const parsed = parseContact(req.body)
      if (!parsed.ok) return reply.code(400).send({ error: parsed.error })
      const { contact } = parsed
      const { purpose } = req.body

      // Капча первой и не зависит от адреса: ответ ничего не раскрывает про email, а бот не доходит ни до кода, ни до бюджета писем.
      // Если сервис капчи не ответил, пропускаем (иначе его сбой не даст войти никому); от перебора по-прежнему защищает строгий лимит.
      if (captcha) {
        if (!req.body.captchaToken) return reply.code(400).send({ error: 'captcha_required' })
        const result = await captcha.verify(req.body.captchaToken, req.ip)
        if (result === 'failed') return reply.code(400).send({ error: 'captcha_failed' })
        if (result === 'unavailable') req.log.error('captcha service unavailable, check skipped')
      }

      // Письма отправляет notifier в пределах дневного бюджета. Если он исчерпан, код не дойдёт до истечения (10 минут),
      // поэтому честно отказываем сразу. Проверка первая и не зависит от адреса, так что ответ ничего не раскрывает,
      // а код и пауза «раз в минуту» не создаются: после освобождения бюджета можно сразу повторить.
      // Для SMS то же самое, только бюджет свой (SMS платные): `sms_busy`.
      if (contact.kind === 'phone' ? await smsBudgetExhausted(pool) : await mailBudgetExhausted(pool)) {
        return reply.code(503).send({ error: contact.kind === 'phone' ? 'sms_busy' : 'mail_busy' })
      }

      // Код и письмо в очереди фиксируются вместе: сбой очереди не оставит «код есть, письма нет» и не включит паузу.
      const tx = await pool.connect()
      try {
        await tx.query('begin')
        const code = await issueEmailCode(contact.key, purpose, tx)
        if (!code) {
          await tx.query('rollback')
          return reply.code(429).send({ error: 'too_soon' })
        }

        // при входе письмо уходит только известному адресу, а ответ одинаков для любого
        const send =
          purpose === 'signup' || (await tx.query(`select 1 from members where ${contact.column} = $1 limit 1`, [contact.value])).rows.length > 0
        if (send) {
          try {
            await enqueue(
              tx,
              contact.kind === 'email'
                ? { channel: 'email', priority: PRIORITY.code, payload: { v: 1, kind: 'code', to: contact.value, code, ttlMinutes: CODE_TTL } }
                : { channel: 'sms', priority: PRIORITY.code, payload: { v: 1, kind: 'code', to: contact.value, code, ttlMinutes: CODE_TTL } },
            )
          } catch (err) {
            await tx.query('rollback').catch(() => {})
            app.log.error(err, 'failed to queue code')
            // при входе молчим, иначе ошибка выдала бы, что email известен; при регистрации честный сбой
            if (purpose === 'login') return reply.code(204).send()
            throw err
          }
        }
        await tx.query('commit')
        return reply.code(204).send()
      } catch (err) {
        await tx.query('rollback').catch(() => {})
        throw err
      } finally {
        tx.release()
      }
    },
  )

  // создание семьи: семья + владелец + первое приглашение
  app.post<{ Body: SignupBody }>(
    '/api/families',
    { schema: createFamilySchema, config: publicStrict },
    async (req, reply) => {
      const parsed = parseContact(req.body)
      if (!parsed.ok) return reply.code(400).send({ error: parsed.error })
      const { contact } = parsed
      if (req.body.consent !== true) return reply.code(400).send({ error: 'consent_required' })
      if (!(await checkEmailCode(contact.key, 'signup', req.body.code))) {
        return reply.code(400).send({ error: 'invalid_code' })
      }

      const db = await pool.connect()
      try {
        await db.query('begin')

        const family = await insertFamily(db)

        const member = await insertMember(db, family.id, req.body, contact, true)
        const invite = await issueInvite(db, family.id)
        await discardEmailCode(db, contact.key, 'signup')
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

      const parsed = parseContact(req.body)
      if (!parsed.ok) return reply.code(400).send({ error: parsed.error })
      const { contact } = parsed
      if (req.body.consent !== true) return reply.code(400).send({ error: 'consent_required' })
      if (!(await checkEmailCode(contact.key, 'signup', req.body.code))) {
        return reply.code(400).send({ error: 'invalid_code' })
      }

      const db = await pool.connect()
      try {
        await db.query('begin')
        // блокировка семьи: два одновременных вступления не обойдут лимит
        await db.query('select id from families where id = $1 for update', [invite.family_id])
        const { rows: count } = await db.query('select count(*)::int as n from members where family_id = $1', [invite.family_id])
        if (count[0].n >= MAX_FAMILY_MEMBERS) {
          await db.query('rollback')
          return reply.code(409).send({ error: 'family_full' })
        }
        const member = await insertMember(db, invite.family_id, req.body, contact, false)
        await discardEmailCode(db, contact.key, 'signup')
        await db.query('commit')
        publish(invite.family_id, { type: 'members' })
        return reply.code(201).send({ family: { code: invite.family_code }, member })
      } catch (err) {
        await db.query('rollback').catch(() => {})
        const constraint = constraintOf(err)
        if (constraint === 'members_family_name_idx') return reply.code(409).send({ error: 'name_taken' })
        if (constraint === 'members_family_email_idx') return reply.code(409).send({ error: 'email_taken' })
        if (constraint === 'members_family_phone_idx') return reply.code(409).send({ error: 'phone_taken' })
        throw err
      } finally {
        db.release()
      }
    },
  )

  // вход по email и коду; если email есть в нескольких семьях, клиент должен выбрать участника
  app.post<{ Body: { email?: string; phone?: string; code: string; memberId?: string } }>(
    '/api/auth/login',
    { schema: loginSchema, config: publicStrict },
    async (req, reply) => {
      const parsed = parseContact(req.body)
      if (!parsed.ok) return reply.code(400).send({ error: parsed.error })
      const { contact } = parsed
      if (!(await checkEmailCode(contact.key, 'login', req.body.code))) {
        return reply.code(401).send({ error: 'invalid_code' })
      }

      const { rows: candidates } = await pool.query(
        `select m.id, m.name, m.role, m.is_owner as "isOwner", f.code as "familyCode",
                (select array_agg(o.name order by o.created_at) from members o
                 where o.family_id = m.family_id) as "familyMembers"
         from members m left join families f on f.id = m.family_id
         where m.${contact.column} = $1 order by m.created_at`,
        [contact.value],
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
        await discardEmailCode(db, contact.key, 'login')
        await db.query('commit')
        return reply.code(201).send({
          // без семьи кода нет: клиент покажет страницу «Создать семью или присоединиться»
          family: { code: chosen.familyCode ?? '' },
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
  app.get('/api/me', { config: { detached: true } }, async (req, reply) => {
    const me = await authenticate(req)
    if (!me) return reply.code(401).send({ error: 'unauthorized' })
    // участник без семьи видит только себя
    const detached = me.family_id === null
    const { rows: members } = await pool.query(
      `select id, name, role, is_owner as "isOwner", avatar,
              to_char(birth_date, 'YYYY-MM-DD') as "birthDate",
              case when role = 'child' and mood is not null then json_build_object('value', mood, 'at', mood_at) end as mood
       from members where ${detached ? 'id' : 'family_id'} = $1 order by created_at`,
      [detached ? me.id : me.family_id],
    )
    return {
      member: {
        // нет семьи: клиент ведёт на страницу «Создать семью или присоединиться по ссылке»
        ...(detached ? { detached: true } : {}),
        id: me.id,
        name: me.name,
        role: me.role,
        isOwner: me.is_owner,
        email: me.email,
        phone: me.phone,
        // согласие на обработку персональных данных нужно дать заново, если участник ещё не согласился или текст обновился
        consentRequired: me.consent_version !== CONSENT_VERSION,
        // раздел «Сервис» (статистика) только у администраторов из ADMIN_EMAILS
        isAdmin: isAdminEmail(me.email),
        avatar: me.avatar,
        birthDate: me.birth_date,
        mood: members.find((m) => m.id === me.id)?.mood ?? null,
        // монеты есть только у детей и только свои: у остальных поля нет
        ...(me.role === 'child' ? { coins: await coinBalance(pool, me.id) } : {}),
      },
      family: { code: me.family_code ?? '' },
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
           returning id, name, role, is_owner as "isOwner", email, phone, avatar,
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

  // Согласие на обработку персональных данных у уже зарегистрированного участника (экран согласия после обновления): фиксируем текущую редакцию.
  // Участник без семьи создаёт новую: он становится её создателем (роль мама или папа), аккаунт и вход остаются прежними.
  app.post<{ Body: { role: 'mama' | 'papa' } }>(
    '/api/me/family',
    { schema: { body: { type: 'object', required: ['role'], additionalProperties: false, properties: { role: { enum: ['mama', 'papa'] } } } }, config: { detached: true, ...strictLimit } },
    async (req, reply) => {
      const me = await authenticate(req)
      if (!me) return reply.code(401).send({ error: 'unauthorized' })
      if (me.family_id !== null) return reply.code(409).send({ error: 'already_in_family' })

      const db = await pool.connect()
      try {
        await db.query('begin')
        const family = await insertFamily(db)
        const { rowCount } = await db.query('update members set family_id = $1, role = $2, is_owner = true where id = $3 and family_id is null', [family.id, req.body.role, me.id])
        if (!rowCount) {
          await db.query('rollback')
          return reply.code(409).send({ error: 'already_in_family' })
        }
        const invite = await issueInvite(db, family.id)
        await db.query('commit')
        return reply.code(201).send({ family: { code: family.code }, member: { id: me.id, name: me.name, role: req.body.role, isOwner: true }, invite })
      } catch (err) {
        await db.query('rollback').catch(() => {})
        throw err
      } finally {
        db.release()
      }
    },
  )

  // Участник без семьи вступает в другую по коду приглашения (из ссылки); имя, контакты, фото и дата рождения остаются при нём, роль выбирает заново.
  app.post<{ Body: { inviteCode: string; role: Role } }>(
    '/api/me/join',
    {
      schema: { body: { type: 'object', required: ['inviteCode', 'role'], additionalProperties: false, properties: { inviteCode: { type: 'string', minLength: 1, maxLength: 100 }, role: { enum: ['mama', 'papa', 'grandma', 'grandpa'] } } } },
      config: { detached: true, ...strictLimit },
    },
    async (req, reply) => {
      const me = await authenticate(req)
      if (!me) return reply.code(401).send({ error: 'unauthorized' })
      if (me.family_id !== null) return reply.code(409).send({ error: 'already_in_family' })

      const { rows } = await pool.query(
        `select i.family_id, i.expires_at, f.code as family_code
         from invites i join families f on f.id = i.family_id where i.code = $1`,
        [req.body.inviteCode.trim()],
      )
      const invite = rows[0]
      if (!invite) return reply.code(404).send({ error: 'invite_not_found' })
      if (new Date(invite.expires_at) < new Date()) return reply.code(410).send({ error: 'invite_expired' })

      const db = await pool.connect()
      try {
        await db.query('begin')
        // блокировка семьи: два одновременных вступления не обойдут лимит
        await db.query('select id from families where id = $1 for update', [invite.family_id])
        const { rows: count } = await db.query('select count(*)::int as n from members where family_id = $1', [invite.family_id])
        if (count[0].n >= MAX_FAMILY_MEMBERS) {
          await db.query('rollback')
          return reply.code(409).send({ error: 'family_full' })
        }
        const { rowCount } = await db.query('update members set family_id = $1, role = $2, is_owner = false where id = $3 and family_id is null', [invite.family_id, req.body.role, me.id])
        if (!rowCount) {
          await db.query('rollback')
          return reply.code(409).send({ error: 'already_in_family' })
        }
        await db.query('commit')
        publish(invite.family_id, { type: 'members' })
        return reply.code(200).send({ family: { code: invite.family_code }, member: { id: me.id, name: me.name, role: req.body.role, isOwner: false } })
      } catch (err) {
        await db.query('rollback').catch(() => {})
        const constraint = constraintOf(err)
        if (constraint === 'members_family_name_idx') return reply.code(409).send({ error: 'name_taken' })
        if (constraint === 'members_family_email_idx') return reply.code(409).send({ error: 'email_taken' })
        if (constraint === 'members_family_phone_idx') return reply.code(409).send({ error: 'phone_taken' })
        throw err
      } finally {
        db.release()
      }
    },
  )

  app.post('/api/me/consent', { config: { detached: true } }, async (req, reply) => {
    const me = await authenticate(req)
    if (!me) return reply.code(401).send({ error: 'unauthorized' })
    await pool.query('update members set consent_version = $2, consent_at = now() where id = $1', [me.id, CONSENT_VERSION])
    return reply.code(204).send()
  })

  // ---- телефон в профиле: добавить или сменить (код приходит SMS на новый номер), убрать ----

  const phoneBody = { type: 'object', required: ['phone'], additionalProperties: false, properties: { phone: phoneSchema } } as const

  // Код на новый номер. Номер, который уже есть у другого участника этой семьи, не принимаем (иначе вход по нему был бы неоднозначным).
  app.post<{ Body: { phone: string } }>('/api/me/phone-code', { schema: { body: phoneBody }, config: strictLimit }, async (req, reply) => {
    const me = await authenticate(req)
    if (!me) return reply.code(401).send({ error: 'unauthorized' })
    // способ связи задаётся один раз и потом не меняется (как email)
    if (me.phone) return reply.code(409).send({ error: 'contact_locked' })
    const parsed = parseContact({ phone: req.body.phone })
    if (!parsed.ok) return reply.code(400).send({ error: parsed.error })
    const { contact } = parsed
    if (await smsBudgetExhausted(pool)) return reply.code(503).send({ error: 'sms_busy' })
    const { rows: taken } = await pool.query('select 1 from members where family_id = $1 and phone = $2 and id <> $3', [me.family_id, contact.value, me.id])
    if (taken[0]) return reply.code(409).send({ error: 'phone_taken' })

    const tx = await pool.connect()
    try {
      await tx.query('begin')
      const code = await issueEmailCode(contact.key, 'verify', tx)
      if (!code) {
        await tx.query('rollback')
        return reply.code(429).send({ error: 'too_soon' })
      }
      await enqueue(tx, { channel: 'sms', priority: PRIORITY.code, payload: { v: 1, kind: 'code', to: contact.value, code, ttlMinutes: CODE_TTL } })
      await tx.query('commit')
      return reply.code(204).send()
    } catch (err) {
      await tx.query('rollback').catch(() => {})
      throw err
    } finally {
      tx.release()
    }
  })

  app.put<{ Body: { phone: string; code: string } }>(
    '/api/me/phone',
    { schema: { body: { type: 'object', required: ['phone', 'code'], additionalProperties: false, properties: { phone: phoneSchema, code: codeSchema } } }, config: strictLimit },
    async (req, reply) => {
      const me = await authenticate(req)
      if (!me) return reply.code(401).send({ error: 'unauthorized' })
      if (me.phone) return reply.code(409).send({ error: 'contact_locked' })
      const parsed = parseContact({ phone: req.body.phone })
      if (!parsed.ok) return reply.code(400).send({ error: parsed.error })
      const { contact } = parsed
      if (!(await checkEmailCode(contact.key, 'verify', req.body.code))) return reply.code(400).send({ error: 'invalid_code' })
      try {
        await pool.query('update members set phone = $2 where id = $1', [me.id, contact.value])
      } catch (err) {
        if (constraintOf(err) === 'members_family_phone_idx') return reply.code(409).send({ error: 'phone_taken' })
        throw err
      }
      await discardEmailCode(pool, contact.key, 'verify')
      publish(me.family_id, { type: 'members' })
      return { phone: contact.value }
    },
  )

  // Email добавляют участнику, который зарегистрировался по телефону: тот же порядок (код на новый адрес, потом подтверждение), только письмом.
  // Как и номер, email задаётся один раз и не меняется; убрать способ связи тоже нельзя.
  app.post<{ Body: { email: string } }>(
    '/api/me/email-code',
    { schema: { body: { type: 'object', required: ['email'], additionalProperties: false, properties: { email: emailSchema } } }, config: strictLimit },
    async (req, reply) => {
      const me = await authenticate(req)
      if (!me) return reply.code(401).send({ error: 'unauthorized' })
      if (me.email) return reply.code(409).send({ error: 'contact_locked' })
      const parsed = parseContact({ email: req.body.email })
      if (!parsed.ok) return reply.code(400).send({ error: parsed.error })
      const { contact } = parsed
      if (await mailBudgetExhausted(pool)) return reply.code(503).send({ error: 'mail_busy' })
      const { rows: taken } = await pool.query('select 1 from members where family_id = $1 and email = $2 and id <> $3', [me.family_id, contact.value, me.id])
      if (taken[0]) return reply.code(409).send({ error: 'email_taken' })

      const tx = await pool.connect()
      try {
        await tx.query('begin')
        const code = await issueEmailCode(contact.key, 'verify', tx)
        if (!code) {
          await tx.query('rollback')
          return reply.code(429).send({ error: 'too_soon' })
        }
        await enqueue(tx, { channel: 'email', priority: PRIORITY.code, payload: { v: 1, kind: 'code', to: contact.value, code, ttlMinutes: CODE_TTL } })
        await tx.query('commit')
        return reply.code(204).send()
      } catch (err) {
        await tx.query('rollback').catch(() => {})
        throw err
      } finally {
        tx.release()
      }
    },
  )

  app.put<{ Body: { email: string; code: string } }>(
    '/api/me/email',
    { schema: { body: { type: 'object', required: ['email', 'code'], additionalProperties: false, properties: { email: emailSchema, code: codeSchema } } }, config: strictLimit },
    async (req, reply) => {
      const me = await authenticate(req)
      if (!me) return reply.code(401).send({ error: 'unauthorized' })
      if (me.email) return reply.code(409).send({ error: 'contact_locked' })
      const parsed = parseContact({ email: req.body.email })
      if (!parsed.ok) return reply.code(400).send({ error: parsed.error })
      const { contact } = parsed
      if (!(await checkEmailCode(contact.key, 'verify', req.body.code))) return reply.code(400).send({ error: 'invalid_code' })
      try {
        await pool.query('update members set email = $2 where id = $1', [me.id, contact.value])
      } catch (err) {
        if (constraintOf(err) === 'members_family_email_idx') return reply.code(409).send({ error: 'email_taken' })
        throw err
      }
      await discardEmailCode(pool, contact.key, 'verify')
      publish(me.family_id, { type: 'members' })
      return { email: contact.value }
    },
  )
}
