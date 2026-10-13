import type { FastifyInstance } from 'fastify'
import { authenticate } from './auth.js'
import { pool } from './db.js'
import { mailDailyLimit } from './outbox/budget.js'
import { queueEnabled } from './outbox/index.js'

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

// Состояние очереди отправки для страницы «Сервис». Сутки по UTC (как у дневного бюджета почты).
export interface QueueStats {
  // включена ли очередь на этом server (QUEUE_ENABLED); иначе письма и push отправляет сам server
  enabled: boolean
  // экземпляры notifier, подавшие признак жизни за последнюю минуту
  notifier: { alive: boolean; instances: number; lastBeatSeconds: number | null }
  // ещё не бравшиеся в работу (attempts = 0, в том числе отложенные из-за лимита)
  waiting: { email: number; push: number }
  // уже пробовались и ждут повтора (или сейчас в работе)
  retrying: number
  // возраст самой старой строки очереди, секунды (null, если очередь пуста)
  oldestSeconds: number | null
  // limit 0: без дневного лимита; usedToday без ждущих в очереди
  mail: { usedToday: number; limit: number }
  today: { email: { sent: number; failed: number }; push: { sent: number; failed: number } }
}

export async function adminRoutes(app: FastifyInstance) {
  // Очередь отправки. Права те же, что у статистики: не администратору раздела нет.
  app.get('/api/admin/queue', async (req, reply) => {
    const me = await authenticate(req)
    if (!me) return reply.code(401).send({ error: 'unauthorized' })
    if (!isAdminEmail(me.email)) return reply.code(404).send({ error: 'not_found' })

    const { rows } = await pool.query(
      `select
         (select count(*) from outbox where channel = 'email' and attempts = 0)::int as waiting_email,
         (select count(*) from outbox where channel = 'push' and attempts = 0)::int as waiting_push,
         (select count(*) from outbox where attempts > 0)::int as retrying,
         (select floor(extract(epoch from now() - min(created_at)))::int from outbox) as oldest,
         (select count(*) from notifier_heartbeat where beat_at > now() - interval '60 seconds')::int as instances,
         (select floor(extract(epoch from now() - max(beat_at)))::int from notifier_heartbeat) as last_beat,
         coalesce((select count from provider_usage where provider = 'mail' and day = (now() at time zone 'UTC')::date), 0)::int as mail_used`,
    )
    const r = rows[0]
    const { rows: delivery } = await pool.query<{ channel: 'email' | 'push'; sent: number; failed: number }>(
      `select channel, sent, failed from delivery_stats where day = (now() at time zone 'UTC')::date`,
    )
    const count = (channel: 'email' | 'push') => delivery.find((d) => d.channel === channel) ?? { sent: 0, failed: 0 }

    const queue: QueueStats = {
      enabled: queueEnabled(),
      notifier: { alive: r.instances > 0, instances: r.instances, lastBeatSeconds: r.last_beat },
      waiting: { email: r.waiting_email, push: r.waiting_push },
      retrying: r.retrying,
      oldestSeconds: r.oldest,
      mail: { usedToday: r.mail_used, limit: mailDailyLimit() },
      today: {
        email: { sent: count('email').sent, failed: count('email').failed },
        push: { sent: count('push').sent, failed: count('push').failed },
      },
    }
    return queue
  })

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
