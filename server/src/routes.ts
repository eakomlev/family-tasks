import type { FastifyInstance, FastifyRequest } from 'fastify'
import type { PoolClient } from 'pg'
import { familyCode, hashToken, inviteCode, memberToken } from './codes.js'
import { pool } from './db.js'

const INVITE_TTL_DAYS = 7
const RECOVERY_TTL_HOURS = 24
const UNIQUE_VIOLATION = '23505'

type Role = 'mama' | 'papa' | 'child'

// эндпоинты, где можно подбирать коды, ограничиваем строже общего лимита
const strictLimit = { rateLimit: { max: 10, timeWindow: '1 minute' } }

const nameSchema = { type: 'string', minLength: 1, maxLength: 40, pattern: '\\S' } as const

const createFamilySchema = {
  body: {
    type: 'object',
    required: ['role', 'name'],
    additionalProperties: false,
    properties: { role: { enum: ['mama', 'papa'] }, name: nameSchema },
  },
}

const joinSchema = {
  body: {
    type: 'object',
    required: ['role', 'name'],
    additionalProperties: false,
    properties: { role: { enum: ['mama', 'papa', 'child'] }, name: nameSchema },
  },
}

async function insertMember(
  db: PoolClient,
  familyId: string,
  name: string,
  role: Role,
  isOwner: boolean,
) {
  const token = memberToken()
  const { rows } = await db.query(
    `insert into members (family_id, name, role, is_owner, token_hash)
     values ($1, $2, $3, $4, $5) returning id`,
    [familyId, name.trim(), role, isOwner, hashToken(token)],
  )
  return { id: rows[0].id as string, name: name.trim(), role, isOwner, token }
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

async function authenticate(req: FastifyRequest) {
  const match = /^Bearer (.+)$/.exec(req.headers.authorization ?? '')
  if (!match) return null
  const { rows } = await pool.query(
    `select m.id, m.name, m.role, m.is_owner, m.family_id, f.code as family_code
     from members m join families f on f.id = m.family_id
     where m.token_hash = $1`,
    [hashToken(match[1])],
  )
  return rows[0] ?? null
}

export async function routes(app: FastifyInstance) {
  app.get('/api/health', async (_req, reply) => {
    try {
      await pool.query('select 1')
      return { status: 'ok' }
    } catch (err) {
      app.log.error(err)
      return reply.code(503).send({ status: 'db_unavailable' })
    }
  })

  // создание семьи: семья + владелец + первое приглашение
  app.post<{ Body: { role: Role; name: string } }>(
    '/api/families',
    { schema: createFamilySchema, config: strictLimit },
    async (req, reply) => {
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
            if ((err as { code?: string }).code !== UNIQUE_VIOLATION) throw err
            await db.query('rollback to savepoint code_try')
          }
        }

        const member = await insertMember(db, family.id, req.body.name, req.body.role, true)
        const invite = await issueInvite(db, family.id)
        await db.query('commit')

        return reply.code(201).send({
          family: { code: family.code },
          member,
          invite,
        })
      } catch (err) {
        await db.query('rollback').catch(() => {})
        throw err
      } finally {
        db.release()
      }
    },
  )

  // проверка приглашения перед показом выбора роли
  app.get<{ Params: { code: string } }>('/api/invites/:code', { config: strictLimit }, async (req, reply) => {
    const { rows } = await pool.query('select expires_at from invites where code = $1', [
      req.params.code,
    ])
    if (!rows[0]) return reply.code(404).send({ error: 'invite_not_found' })
    if (new Date(rows[0].expires_at) < new Date()) {
      return reply.code(410).send({ error: 'invite_expired' })
    }
    return { expiresAt: rows[0].expires_at }
  })

  app.post<{ Params: { code: string }; Body: { role: Role; name: string } }>(
    '/api/invites/:code/join',
    { schema: joinSchema, config: strictLimit },
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

      const db = await pool.connect()
      try {
        const member = await insertMember(db, invite.family_id, req.body.name, req.body.role, false)
        return reply.code(201).send({ family: { code: invite.family_code }, member })
      } catch (err) {
        if ((err as { code?: string }).code === UNIQUE_VIOLATION) {
          return reply.code(409).send({ error: 'name_taken' })
        }
        throw err
      } finally {
        db.release()
      }
    },
  )

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

  // ссылка для входа участника на другом устройстве: себе или (владельцем) другому
  app.post<{ Params: { id: string } }>(
    '/api/members/:id/recovery',
    { schema: { params: { type: 'object', properties: { id: { type: 'string', format: 'uuid' } } } } },
    async (req, reply) => {
      const me = await authenticate(req)
      if (!me) return reply.code(401).send({ error: 'unauthorized' })
      if (req.params.id !== me.id && !me.is_owner) return reply.code(403).send({ error: 'forbidden' })

      const target = await pool.query('select id from members where id = $1 and family_id = $2', [
        req.params.id,
        me.family_id,
      ])
      if (!target.rows[0]) return reply.code(404).send({ error: 'member_not_found' })

      const { rows } = await pool.query(
        `insert into recoveries (member_id, code, expires_at)
         values ($1, $2, now() + make_interval(hours => $3))
         on conflict (member_id) do update
           set code = excluded.code, expires_at = excluded.expires_at, created_at = now()
         returning code, expires_at as "expiresAt"`,
        [req.params.id, inviteCode(), RECOVERY_TTL_HOURS],
      )
      return reply.code(201).send(rows[0])
    },
  )

  app.get<{ Params: { code: string } }>('/api/recoveries/:code', { config: strictLimit }, async (req, reply) => {
    const { rows } = await pool.query(
      `select m.name, m.role, r.expires_at from recoveries r
       join members m on m.id = r.member_id where r.code = $1`,
      [req.params.code],
    )
    if (!rows[0]) return reply.code(404).send({ error: 'recovery_not_found' })
    if (new Date(rows[0].expires_at) < new Date()) return reply.code(410).send({ error: 'recovery_expired' })
    return { name: rows[0].name, role: rows[0].role }
  })

  // вход на новом устройстве: выдаём новый токен, старый перестаёт работать
  app.post<{ Params: { code: string } }>('/api/recoveries/:code/claim', { config: strictLimit }, async (req, reply) => {
    const db = await pool.connect()
    try {
      await db.query('begin')
      const { rows } = await db.query(
        'delete from recoveries where code = $1 returning member_id, expires_at',
        [req.params.code],
      )
      if (!rows[0]) {
        await db.query('rollback')
        return reply.code(404).send({ error: 'recovery_not_found' })
      }
      if (new Date(rows[0].expires_at) < new Date()) {
        await db.query('commit')
        return reply.code(410).send({ error: 'recovery_expired' })
      }

      const token = memberToken()
      const member = await db.query(
        `update members m set token_hash = $2 from families f
         where m.id = $1 and f.id = m.family_id
         returning m.id, m.name, m.role, m.is_owner as "isOwner", f.code as family_code`,
        [rows[0].member_id, hashToken(token)],
      )
      await db.query('commit')

      const { family_code, ...rest } = member.rows[0]
      return reply.code(201).send({ family: { code: family_code }, member: { ...rest, token } })
    } catch (err) {
      await db.query('rollback').catch(() => {})
      throw err
    } finally {
      db.release()
    }
  })

  // текущий участник и состав семьи
  app.get('/api/me', async (req, reply) => {
    const me = await authenticate(req)
    if (!me) return reply.code(401).send({ error: 'unauthorized' })
    const { rows: members } = await pool.query(
      `select id, name, role, is_owner as "isOwner" from members
       where family_id = $1 order by created_at`,
      [me.family_id],
    )
    return {
      member: { id: me.id, name: me.name, role: me.role, isOwner: me.is_owner },
      family: { code: me.family_code },
      members,
    }
  })
}
