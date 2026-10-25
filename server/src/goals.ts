import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { authorizeChild, type MemberParams } from './access.js'
import { authenticate } from './auth.js'
import { coinBalance } from './coins.js'
import { pool } from './db.js'
import type { PushMessage } from './outbox/contract.js'
import { enqueueToMember } from './outbox/index.js'
import { publish } from './realtime.js'
import { isParent } from './roles.js'
import { coinsWord } from './tasks/text.js'

const idParams = { type: 'object', properties: { id: { type: 'string', format: 'uuid' } } }

// как у фото профиля: картинку клиент присылает уже сжатой, сервер ограничивает тип и размер
const imageSchema = {
  type: ['string', 'null'],
  maxLength: 70000,
  pattern: '^data:image/(jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$',
} as const

const goalBody = {
  type: 'object',
  required: ['title', 'price'],
  additionalProperties: false,
  properties: {
    title: { type: 'string', minLength: 1, maxLength: 80, pattern: '\\S' },
    price: { type: 'integer', minimum: 1, maximum: 100000 },
    url: { type: ['string', 'null'], maxLength: 500, pattern: '^https?://\\S+$' },
    image: imageSchema,
  },
}

interface GoalInput {
  title: string
  price: number
  url?: string | null
  image?: string | null
}

interface GoalRow {
  id: string
  memberId: string
  title: string
  price: number
  url: string | null
  image: string | null
  createdAt: string
  purchasedAt: string | null
}

const COLUMNS = `id, member_id as "memberId", title, price, url, image, created_at as "createdAt", purchased_at as "purchasedAt"`

// Родителям: ребёнок оплатил цель.
export const goalPurchasedMessage = (goal: Pick<GoalRow, 'id' | 'title' | 'price'>, childName: string): PushMessage => ({
  title: 'Цель куплена',
  body: `${childName}: «${goal.title}», ${coinsWord(goal.price)}`,
  url: `/goals/${goal.id}`,
  tag: `goal-${goal.id}`,
})

export async function goalRoutes(app: FastifyInstance) {
  // Цель из адреса, доступная вошедшему: ребёнок видит свои, родитель любые цели своей семьи.
  async function findGoal(req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    const me = await authenticate(req)
    if (!me) {
      reply.code(401).send({ error: 'unauthorized' })
      return null
    }
    const { rows } = await pool.query<GoalRow>(`select ${COLUMNS} from goals where id = $1 and family_id = $2`, [req.params.id, me.family_id])
    const goal = rows[0]
    if (!goal || (me.role === 'child' && goal.memberId !== me.id)) {
      reply.code(404).send({ error: 'goal_not_found' })
      return null
    }
    return { me, goal }
  }

  const parentsOnly = (role: string, reply: FastifyReply) => {
    if (!isParent(role)) {
      reply.code(403).send({ error: 'parents_only' })
      return false
    }
    return true
  }

  // Цели ребёнка: сначала ещё не купленные (старые выше), затем купленные. Видит сам ребёнок и родители.
  app.get<MemberParams>('/api/members/:id/goals', { schema: { params: idParams } }, async (req, reply) => {
    const memberId = await authorizeChild(req, reply)
    if (!memberId) return
    const { rows } = await pool.query<GoalRow>(
      `select ${COLUMNS} from goals where member_id = $1 order by (purchased_at is not null), created_at, id`,
      [memberId],
    )
    return { goals: rows }
  })

  app.post<MemberParams & { Body: GoalInput }>('/api/members/:id/goals', { schema: { params: idParams, body: goalBody } }, async (req, reply) => {
    const memberId = await authorizeChild(req, reply, true)
    if (!memberId) return
    const me = (await authenticate(req))!
    if (!parentsOnly(me.role, reply)) return

    const { title, price, url = null, image = null } = req.body
    const { rows } = await pool.query<GoalRow>(
      `insert into goals (family_id, member_id, title, price, url, image, created_by) values ($1, $2, $3, $4, $5, $6, $7) returning ${COLUMNS}`,
      [me.family_id, memberId, title.trim(), price, url, image, me.id],
    )
    publish(me.family_id, { type: 'goals', memberId })
    return reply.code(201).send({ goal: rows[0] })
  })

  app.get<{ Params: { id: string } }>('/api/goals/:id', { schema: { params: idParams } }, async (req, reply) => {
    const found = await findGoal(req, reply)
    if (!found) return
    // сколько монет у ребёнка: на карточке цели видно, хватает ли
    return { goal: found.goal, balance: await coinBalance(pool, found.goal.memberId) }
  })

  // Менять и удалять могут только родители; купленную цель менять нельзя (только удалить).
  app.put<{ Params: { id: string }; Body: GoalInput }>('/api/goals/:id', { schema: { params: idParams, body: goalBody } }, async (req, reply) => {
    const found = await findGoal(req, reply)
    if (!found || !parentsOnly(found.me.role, reply)) return
    if (found.goal.purchasedAt) return reply.code(409).send({ error: 'already_purchased' })

    const { title, price, url = null, image = null } = req.body
    const { rows } = await pool.query<GoalRow>(
      `update goals set title = $2, price = $3, url = $4, image = $5 where id = $1 returning ${COLUMNS}`,
      [found.goal.id, title.trim(), price, url, image],
    )
    publish(found.me.family_id, { type: 'goals', memberId: found.goal.memberId })
    return { goal: rows[0] }
  })

  app.delete<{ Params: { id: string } }>('/api/goals/:id', { schema: { params: idParams } }, async (req, reply) => {
    const found = await findGoal(req, reply)
    if (!found || !parentsOnly(found.me.role, reply)) return
    await pool.query('delete from goals where id = $1', [found.goal.id])
    publish(found.me.family_id, { type: 'goals', memberId: found.goal.memberId })
    return reply.code(204).send()
  })

  // Оплата: только сам ребёнок и только если хватает монет. Списание, отметка о покупке и проверка баланса идут в одной
  // транзакции под блокировкой строки ребёнка, поэтому два одновременных нажатия не купят цель дважды и не уведут баланс в минус.
  app.post<{ Params: { id: string } }>('/api/goals/:id/purchase', { schema: { params: idParams } }, async (req, reply) => {
    const found = await findGoal(req, reply)
    if (!found) return
    const { me, goal } = found
    if (me.id !== goal.memberId) return reply.code(403).send({ error: 'children_only' })

    const db = await pool.connect()
    try {
      await db.query('begin')
      await db.query('select id from members where id = $1 for update', [me.id])
      const { rows } = await db.query<{ purchasedAt: string | null; price: number; title: string }>(
        'select purchased_at as "purchasedAt", price, title from goals where id = $1 for update',
        [goal.id],
      )
      const current = rows[0]
      if (!current) {
        await db.query('rollback')
        return reply.code(404).send({ error: 'goal_not_found' })
      }
      if (current.purchasedAt) {
        await db.query('rollback')
        return reply.code(409).send({ error: 'already_purchased' })
      }
      const balance = await coinBalance(db, me.id)
      if (balance < current.price) {
        await db.query('rollback')
        return reply.code(409).send({ error: 'not_enough_coins', missing: current.price - balance, balance })
      }
      await db.query(
        `insert into coin_transactions (member_id, amount, reason, created_by, goal_id) values ($1, $2, $3, $1, $4)`,
        [me.id, -current.price, `Цель: ${current.title}`, goal.id],
      )
      const { rows: updated } = await db.query<GoalRow>(`update goals set purchased_at = now() where id = $1 returning ${COLUMNS}`, [goal.id])
      await db.query('commit')

      publish(me.family_id, { type: 'goals', memberId: me.id })
      publish(me.family_id, { type: 'members' })
      const { rows: parents } = await pool.query<{ id: string }>(`select id from members where family_id = $1 and role in ('mama', 'papa')`, [me.family_id])
      for (const p of parents) await enqueueToMember(pool, p.id, goalPurchasedMessage(updated[0], me.name))
      return { goal: updated[0], balance: balance - current.price }
    } catch (err) {
      await db.query('rollback').catch(() => {})
      throw err
    } finally {
      db.release()
    }
  })
}
