import type { FastifyInstance, FastifyRequest } from 'fastify'
import type { PoolClient } from 'pg'
import { familyCode, hashToken, inviteCode, memberToken } from './codes.js'
import { pool } from './db.js'

const INVITE_TTL_DAYS = 7
const UNIQUE_VIOLATION = '23505'

type Role = 'mama' | 'papa' | 'child'

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
    { schema: createFamilySchema },
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
        const invite = await db.query(
          `insert into invites (family_id, code, expires_at)
           values ($1, $2, now() + make_interval(days => $3)) returning code, expires_at`,
          [family.id, inviteCode(), INVITE_TTL_DAYS],
        )
        await db.query('commit')

        return reply.code(201).send({
          family: { code: family.code },
          member,
          invite: { code: invite.rows[0].code, expiresAt: invite.rows[0].expires_at },
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
  app.get<{ Params: { code: string } }>('/api/invites/:code', async (req, reply) => {
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
    { schema: joinSchema },
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
