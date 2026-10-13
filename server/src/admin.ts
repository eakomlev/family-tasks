import type { FastifyInstance } from 'fastify'
import { authenticate } from './auth.js'
import { pool } from './db.js'

// Адреса администраторов сервиса: переменная ADMIN_EMAILS (через запятую, регистр не важен). Читается при каждой проверке,
// поэтому в тестах её можно задать до запроса. Пусто: администраторов нет, раздел «Сервис» недоступен никому.
export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false
  const admins = (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
  return admins.includes(email.trim().toLowerCase())
}

const statsSchema = {
  querystring: {
    type: 'object',
    required: ['since'],
    properties: { since: { type: 'string', format: 'date-time' } },
  },
}

export interface ServiceStats {
  accounts: { total: number; today: number }
  families: { total: number; today: number }
  messages: { total: number; today: number }
}

export async function adminRoutes(app: FastifyInstance) {
  // Сводка для администратора. since: начало «сегодняшнего» дня (ISO): часовой пояс знает только клиент (как у «заработано сегодня»).
  // Не администратору отвечаем так же, как на несуществующий адрес: раздела для него нет.
  app.get<{ Querystring: { since: string } }>('/api/admin/stats', { schema: statsSchema }, async (req, reply) => {
    const me = await authenticate(req)
    if (!me) return reply.code(401).send({ error: 'unauthorized' })
    if (!isAdminEmail(me.email)) return reply.code(404).send({ error: 'not_found' })

    const { rows } = await pool.query(
      `select
         (select count(*) from members)::int as accounts_total,
         (select count(*) from members where created_at >= $1)::int as accounts_today,
         (select count(*) from families)::int as families_total,
         (select count(*) from families where created_at >= $1)::int as families_today,
         (select count(*) from messages)::int as messages_total,
         (select count(*) from messages where created_at >= $1)::int as messages_today`,
      [req.query.since],
    )
    const r = rows[0]
    const stats: ServiceStats = {
      accounts: { total: r.accounts_total, today: r.accounts_today },
      families: { total: r.families_total, today: r.families_today },
      messages: { total: r.messages_total, today: r.messages_today },
    }
    return stats
  })
}
