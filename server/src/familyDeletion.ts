import type { FastifyInstance } from 'fastify'
import { authenticate } from './auth.js'
import { pool } from './db.js'

const strictLimit = { rateLimit: { max: 10, timeWindow: '1 minute' } }

// Удаление семьи. Здесь только заявка: сами данные и файлы удаляет планировщик (`scheduler/src/familyDeletion.ts`) на ближайшем
// проходе, обычно в течение минуты. Просить об удалении может только создатель семьи. Повторная заявка ничего не меняет.
export async function familyDeletionRoutes(app: FastifyInstance) {
  app.post('/api/family/deletion', { config: strictLimit }, async (req, reply) => {
    const me = await authenticate(req)
    if (!me) return reply.code(401).send({ error: 'unauthorized' })
    if (!me.is_owner) return reply.code(403).send({ error: 'forbidden' })

    const { rows } = await pool.query<{ requestedAt: string }>(
      `with ins as (
         insert into family_deletions (family_id, requested_by) values ($1, $2)
         on conflict (family_id) do nothing returning requested_at
       )
       select requested_at as "requestedAt" from ins
       union all
       select requested_at from family_deletions where family_id = $1
       limit 1`,
      [me.family_id, me.id],
    )
    return reply.code(202).send({ requestedAt: rows[0].requestedAt })
  })
}
