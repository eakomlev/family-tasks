import type { FastifyInstance } from 'fastify'
import { authenticate } from './auth.js'
import { pool } from './db.js'
import { publish } from './realtime.js'
import { isAdult } from './roles.js'

const surnameSchema = { type: 'string', minLength: 1, maxLength: 80, pattern: '\\S' } as const

export async function familyConnectionRoutes(app: FastifyInstance) {
  app.get('/api/family/connections', async (req, reply) => {
    const me = await authenticate(req)
    if (!me) return reply.code(401).send({ error: 'unauthorized' })
    const familyId = me.family_id
    const { rows: connections } = await pool.query(
      `select f.id as "familyId", f.code, f.surname,
              coalesce(json_agg(json_build_object('id', m.id, 'name', m.name, 'role', m.role, 'isOwner', m.is_owner,
                'avatar', m.avatar, 'birthDate', to_char(m.birth_date, 'YYYY-MM-DD')) order by m.created_at)
                filter (where m.id is not null), '[]') as members
       from family_connections c
       join families f on f.id = case when c.family_a_id = $1 then c.family_b_id else c.family_a_id end
       left join members m on m.family_id = f.id
       where c.family_a_id = $1 or c.family_b_id = $1
       group by f.id order by f.created_at`, [familyId])
    const { rows: requests } = await pool.query(
      `select r.id, r.status, r.created_at as "createdAt", r.from_family_id = $1 as "outgoing",
              f.code as "familyCode", case when r.from_family_id = $1 then f.surname else r.from_surname end as surname,
              r.from_surname as "fromSurname"
       from family_connection_requests r
       join families f on f.id = case when r.from_family_id = $1 then r.to_family_id else r.from_family_id end
       where (r.from_family_id = $1 or r.to_family_id = $1) and r.status = 'pending'
       order by r.created_at desc`, [familyId])
    const { rows: [family] } = await pool.query('select surname from families where id = $1', [familyId])
    return { surname: family?.surname ?? null, connections, requests: isAdult(me.role) ? requests : [] }
  })

  app.post<{ Body: { familyCode: string; surname: string } }>('/api/family/connections/requests', {
    schema: { body: { type: 'object', required: ['familyCode', 'surname'], additionalProperties: false,
      properties: { familyCode: { type: 'string', minLength: 1, maxLength: 32 }, surname: surnameSchema } } },
  }, async (req, reply) => {
    const me = await authenticate(req)
    if (!me) return reply.code(401).send({ error: 'unauthorized' })
    if (!isAdult(me.role)) return reply.code(403).send({ error: 'adults_only' })
    const { rows: [target] } = await pool.query<{ id: string }>('select id from families where lower(code) = lower($1)', [req.body.familyCode.trim()])
    if (!target) return reply.code(404).send({ error: 'family_not_found' })
    if (target.id === me.family_id) return reply.code(400).send({ error: 'same_family' })
    const [a, b] = [me.family_id!, target.id].sort()
    const { rowCount: linked } = await pool.query('select 1 from family_connections where family_a_id = $1 and family_b_id = $2', [a, b])
    if (linked) return reply.code(409).send({ error: 'already_connected' })
    const { rowCount: pending } = await pool.query(
      `select 1 from family_connection_requests where status = 'pending'
       and ((from_family_id = $1 and to_family_id = $2) or (from_family_id = $2 and to_family_id = $1))`, [a, b])
    if (pending) return reply.code(409).send({ error: 'request_exists' })
    const db = await pool.connect()
    try {
      await db.query('begin')
      const { rows: [senderFamily] } = await db.query<{ surname: string }>(
        'update families set surname = coalesce(surname, $2) where id = $1 returning surname', [me.family_id, req.body.surname.trim()])
      const { rows } = await db.query(
        `insert into family_connection_requests (from_family_id, to_family_id, from_surname, created_by)
         values ($1, $2, $3, $4) returning id`, [me.family_id, target.id, senderFamily.surname, me.id])
      await db.query('commit')
      publish(me.family_id!, { type: 'members' })
      publish(target.id, { type: 'members' })
      return reply.code(201).send({ id: rows[0].id })
    } catch (error) {
      await db.query('rollback')
      if ((error as { code?: string }).code === '23505') return reply.code(409).send({ error: 'request_exists' })
      throw error
    } finally { db.release() }
  })

  app.post<{ Params: { id: string }; Body: { action: 'accept' | 'reject'; surname?: string } }>('/api/family/connections/requests/:id', {
    schema: { body: { type: 'object', required: ['action'], additionalProperties: false,
      properties: { action: { enum: ['accept', 'reject'] }, surname: surnameSchema } } },
  }, async (req, reply) => {
    const me = await authenticate(req)
    if (!me) return reply.code(401).send({ error: 'unauthorized' })
    if (!isAdult(me.role)) return reply.code(403).send({ error: 'adults_only' })
    const db = await pool.connect()
    try {
      await db.query('begin')
      const { rows: [request] } = await db.query<{ id: string; from_family_id: string; to_family_id: string; from_surname: string }>(
        `select id, from_family_id, to_family_id, from_surname from family_connection_requests
         where id = $1 and to_family_id = $2 and status = 'pending' for update`, [req.params.id, me.family_id])
      if (!request) { await db.query('rollback'); return reply.code(404).send({ error: 'request_not_found' }) }
      if (req.body.action === 'accept') {
        const { rows: [receiverFamily] } = await db.query<{ surname: string | null }>('select surname from families where id = $1 for update', [me.family_id])
        if (!receiverFamily?.surname && !req.body.surname?.trim()) {
          await db.query('rollback')
          return reply.code(400).send({ error: 'surname_required' })
        }
        await db.query(`update families set surname = coalesce(surname, $2) where id = $1`, [me.family_id, req.body.surname?.trim() ?? null])
        const [a, b] = [request.from_family_id, request.to_family_id].sort()
        await db.query('insert into family_connections (family_a_id, family_b_id) values ($1, $2) on conflict do nothing', [a, b])
      }
      await db.query(`update family_connection_requests set status = $2, resolved_at = now() where id = $1`, [request.id, req.body.action === 'accept' ? 'accepted' : 'rejected'])
      await db.query('commit')
      publish(request.from_family_id, { type: 'members' })
      publish(request.to_family_id, { type: 'members' })
      return reply.code(204).send()
    } catch (error) { await db.query('rollback'); throw error } finally { db.release() }
  })

  app.delete<{ Params: { familyId: string } }>('/api/family/connections/:familyId', async (req, reply) => {
    const me = await authenticate(req)
    if (!me) return reply.code(401).send({ error: 'unauthorized' })
    if (!me.is_owner) return reply.code(403).send({ error: 'owner_only' })
    const [a, b] = [me.family_id!, req.params.familyId].sort()
    const db = await pool.connect()
    let rowCount: number
    try {
      await db.query('begin')
      const result = await db.query('delete from family_connections where family_a_id = $1 and family_b_id = $2', [a, b])
      rowCount = result.rowCount ?? 0
      if (rowCount) {
        await db.query(
          `delete from event_members em using events e, members target
           where e.id = em.event_id and target.id = em.member_id
             and ((e.family_id = $1 and target.family_id = $2) or (e.family_id = $2 and target.family_id = $1))`, [a, b])
        await db.query(
          `delete from event_family_targets ef using events e
           where e.id = ef.event_id and ((e.family_id = $1 and ef.family_id = $2) or (e.family_id = $2 and ef.family_id = $1))`, [a, b])
        await db.query(
          `update games set status = 'cancelled', updated_at = now()
           where status in ('invited', 'active') and (
             (exists (select 1 from members m where m.id = games.inviter_id and m.family_id = $1)
              and exists (select 1 from members m where m.id = games.invitee_id and m.family_id = $2))
             or
             (exists (select 1 from members m where m.id = games.inviter_id and m.family_id = $2)
              and exists (select 1 from members m where m.id = games.invitee_id and m.family_id = $1))
           )`, [a, b])
      }
      await db.query('commit')
    } catch (error) { await db.query('rollback'); throw error } finally { db.release() }
    if (!rowCount) return reply.code(404).send({ error: 'connection_not_found' })
    publish(a, { type: 'members' }); publish(b, { type: 'members' })
    publish(a, { type: 'games' }); publish(b, { type: 'games' })
    publish(a, { type: 'events' }); publish(b, { type: 'events' })
    return reply.code(204).send()
  })
}
