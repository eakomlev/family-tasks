import type { FastifyReply, FastifyRequest } from 'fastify'
import { authenticate } from './auth.js'
import { pool } from './db.js'

export type MemberParams = { Params: { id: string } }

// Расписания (уроков, тренировок) есть только у детей; видеть и менять их могут сам ребёнок
// и родители (мама/папа) его семьи. Возвращает id ребёнка или null, если ответ уже отправлен.
export async function authorizeChild(req: FastifyRequest<MemberParams>, reply: FastifyReply) {
  const me = await authenticate(req)
  if (!me) {
    reply.code(401).send({ error: 'unauthorized' })
    return null
  }

  const { rows } = await pool.query('select id, role from members where id = $1 and family_id = $2', [
    req.params.id,
    me.family_id,
  ])
  const target = rows[0]
  if (!target) {
    reply.code(404).send({ error: 'member_not_found' })
    return null
  }
  if (target.role !== 'child') {
    reply.code(400).send({ error: 'not_a_child' })
    return null
  }
  if (me.id !== target.id && me.role === 'child') {
    reply.code(403).send({ error: 'forbidden' })
    return null
  }
  return target.id as string
}
