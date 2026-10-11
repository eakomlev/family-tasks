import type { FastifyInstance } from 'fastify'
import type { Pool, PoolClient } from 'pg'
import { authenticate } from './auth.js'
import { pool } from './db.js'

type Db = Pick<Pool | PoolClient, 'query'>

// Текущий баланс монет участника: сумма журнала начислений и списаний.
export async function coinBalance(db: Db, memberId: string): Promise<number> {
  const { rows } = await db.query('select coalesce(sum(amount), 0)::int as balance from coin_transactions where member_id = $1', [memberId])
  return rows[0].balance as number
}

const PAGE_SIZE = 30

const historySchema = {
  querystring: {
    type: 'object',
    properties: {
      before: { type: 'string', format: 'uuid' },
      limit: { type: 'integer', minimum: 1, maximum: 100, default: PAGE_SIZE },
      // чьи монеты: только для родителей (ребёнок видит свои)
      memberId: { type: 'string', format: 'uuid' },
    },
  },
}

interface HistoryRow {
  id: string
  amount: number
  reason: string
  createdAt: string
  createdBy: string | null
}

const earnedSchema = {
  querystring: {
    type: 'object',
    required: ['since'],
    properties: { since: { type: 'string', format: 'date-time' } },
  },
}

export async function coinRoutes(app: FastifyInstance) {
  // Сколько монет ребёнок заработал с момента since (клиент присылает начало своего дня: часовой пояс знает только он).
  // Считаются начисления и отмена наград за задания (если награду забрали, она не считается заработанной);
  // траты и прочие списания не уменьшают «заработано». Результат не бывает отрицательным.
  app.get<{ Querystring: { since: string } }>('/api/coins/earned', { schema: earnedSchema }, async (req, reply) => {
    const me = await authenticate(req)
    if (!me) return reply.code(401).send({ error: 'unauthorized' })
    if (me.role !== 'child') return reply.code(403).send({ error: 'not_a_child' })
    const { rows } = await pool.query(
      `select greatest(0, coalesce(sum(amount), 0))::int as earned
       from coin_transactions
       where member_id = $1 and created_at >= $2 and (amount > 0 or task_id is not null)`,
      [me.id, req.query.since],
    )
    return { earned: rows[0].earned as number }
  })

  // История монет ребёнка, свежее сверху, постранично: before = id самой старой из уже загруженных записей.
  // Ребёнок видит свою историю. Родитель (мама или папа) видит историю ребёнка своей семьи (memberId): ему же её и начислять.
  // Дети чужие монеты не видят.
  app.get<{ Querystring: { before?: string; limit?: number; memberId?: string } }>('/api/coins', { schema: historySchema }, async (req, reply) => {
    const me = await authenticate(req)
    if (!me) return reply.code(401).send({ error: 'unauthorized' })

    let targetId: string = me.id
    const asked = req.query.memberId
    if (asked && asked !== me.id) {
      if (me.role === 'child') return reply.code(403).send({ error: 'forbidden' })
      const { rows: target } = await pool.query('select id, role from members where id = $1 and family_id = $2', [asked, me.family_id])
      if (!target[0]) return reply.code(404).send({ error: 'member_not_found' })
      if (target[0].role !== 'child') return reply.code(400).send({ error: 'not_a_child' })
      targetId = target[0].id
    } else if (me.role !== 'child') {
      return reply.code(403).send({ error: 'not_a_child' })
    }

    const limit = req.query.limit ?? PAGE_SIZE
    const { rows } = await pool.query<HistoryRow>(
      `select id, amount, reason, created_at as "createdAt", created_by as "createdBy"
       from coin_transactions
       where member_id = $1
         and ($2::uuid is null or (created_at, id) < (select created_at, id from coin_transactions where id = $2 and member_id = $1))
       order by created_at desc, id desc limit $3`,
      [targetId, req.query.before ?? null, limit + 1],
    )
    return {
      balance: await coinBalance(pool, targetId),
      items: rows.slice(0, limit),
      hasMore: rows.length > limit,
    }
  })
}
