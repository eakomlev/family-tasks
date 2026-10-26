import type { FastifyInstance } from 'fastify'
import { authenticate } from './auth.js'
import { pool } from './db.js'
import type { MediaClient } from './media/client.js'
import { mediaQuotaBytes } from './media/index.js'
import { mailDailyLimit, smsDailyLimit } from './outbox/budget.js'

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
  // планировщик плановых напоминаний (scheduler): жив ли, когда лидер в последний раз делал проход и чем он кончился
  scheduler: {
    alive: boolean
    instances: number
    lastBeatSeconds: number | null
    // секунд с последнего прохода лидера (null: проходов ещё не было)
    lastTickSeconds: number | null
    // сколько напоминаний поставил последний проход и текст его ошибки (null, если прошёл без ошибки)
    lastSent: number | null
    lastError: string | null
  }
  // сервис живых обновлений (realtime): жив ли и сколько открытых соединений
  realtime: { alive: boolean; instances: number; connections: number; lastBeatSeconds: number | null }
}

// SMS для страницы «Сервис»: отправлено и потрачено, остаток на счёте у SMS Aero, дневной потолок. Сутки по UTC.
export interface SmsStats {
  // ключи SMS Aero заданы у notifier: он пишет остаток в provider_balance; пока записи нет, считаем, что SMS не настроены
  configured: boolean
  // остаток на счёте, рубли (null: ещё ни одной удачной проверки), сколько секунд назад проверен и ошибка последней проверки
  balance: { amount: number | null; checkedSeconds: number | null; error: string | null }
  today: { sent: number; failed: number; spend: number }
  // за последние 7 суток, включая сегодня
  week: { sent: number; failed: number; spend: number }
  // по дням, свежие первыми (только дни, в которые что-то отправлялось)
  days: { day: string; sent: number; failed: number; spend: number }[]
  // ещё не бравшиеся в работу и ждущие повтора
  waiting: number
  retrying: number
  // limit 0: без дневного лимита; usedToday без ждущих в очереди
  limit: number
  usedToday: number
}

// Фото в чатах для страницы «Сервис»: что сохранено и занимает место, жив ли сервис media.
export interface MediaStats {
  // настроены ли фото (MEDIA_SECRET и MEDIA_INTERNAL_TOKEN); если нет, остальное нули и alive false
  configured: boolean
  // отвечает ли сервис media вместе с хранилищем
  alive: boolean
  photos: number
  bytes: number
  // загружено, но не прикреплено к сообщению (через сутки их убирает уборка)
  unattached: { photos: number; bytes: number }
  // квота одной семьи и сколько занимает самая «тяжёлая» семья
  quotaBytes: number
  busiestFamilyBytes: number
}

export interface AdminOptions {
  media: { client: MediaClient; secret: string } | null
}

export async function adminRoutes(app: FastifyInstance, { media = null }: Partial<AdminOptions> = {}) {
  // Фото в чатах. Права те же, что у остальных страниц «Сервиса».
  app.get('/api/admin/media', async (req, reply) => {
    const me = await authenticate(req)
    if (!me) return reply.code(401).send({ error: 'unauthorized' })
    if (!isAdminEmail(me.email)) return reply.code(404).send({ error: 'not_found' })

    const { rows } = await pool.query(
      `select
         count(*)::int as photos,
         coalesce(sum(size), 0)::float8 as bytes,
         (count(*) filter (where attached_at is null))::int as loose_photos,
         coalesce(sum(size) filter (where attached_at is null), 0)::float8 as loose_bytes,
         coalesce((select max(total) from (select sum(size) as total from media group by family_id) f), 0)::float8 as busiest
       from media`,
    )
    const r = rows[0]
    const stats: MediaStats = {
      configured: media !== null,
      alive: media ? await media.client.health() : false,
      photos: r.photos,
      bytes: r.bytes,
      unattached: { photos: r.loose_photos, bytes: r.loose_bytes },
      quotaBytes: mediaQuotaBytes(),
      busiestFamilyBytes: r.busiest,
    }
    return stats
  })

  // SMS: расход, остаток на счёте и потолок. Права те же, что у остальных страниц «Сервиса».
  app.get('/api/admin/sms', async (req, reply) => {
    const me = await authenticate(req)
    if (!me) return reply.code(401).send({ error: 'unauthorized' })
    if (!isAdminEmail(me.email)) return reply.code(404).send({ error: 'not_found' })

    const { rows: [r] } = await pool.query(
      `select
         (select count(*) from provider_balance where provider = 'smsaero')::int as has_balance,
         (select balance::float8 from provider_balance where provider = 'smsaero') as balance,
         (select floor(extract(epoch from now() - checked_at))::int from provider_balance where provider = 'smsaero') as checked,
         (select error from provider_balance where provider = 'smsaero') as balance_error,
         (select count(*) from outbox where channel = 'sms' and attempts = 0)::int as waiting,
         (select count(*) from outbox where channel = 'sms' and attempts > 0)::int as retrying,
         coalesce((select count from provider_usage where provider = 'sms' and day = (now() at time zone 'UTC')::date), 0)::int as used`,
    )
    const { rows: days } = await pool.query<{ day: string; sent: number; failed: number; spend: number }>(
      `select day::text as day, sent, failed, spend::float8 as spend from delivery_stats
        where channel = 'sms' and day > (now() at time zone 'UTC')::date - 7 order by day desc`,
    )
    const today = new Date().toISOString().slice(0, 10)
    const sum = (rows: typeof days) => ({
      sent: rows.reduce((n, d) => n + d.sent, 0),
      failed: rows.reduce((n, d) => n + d.failed, 0),
      spend: Math.round(rows.reduce((n, d) => n + d.spend, 0) * 100) / 100,
    })
    const stats: SmsStats = {
      configured: r.has_balance > 0,
      balance: { amount: r.balance, checkedSeconds: r.checked, error: r.balance_error },
      today: sum(days.filter((d) => d.day === today)),
      week: sum(days),
      days,
      waiting: r.waiting,
      retrying: r.retrying,
      limit: smsDailyLimit(),
      usedToday: r.used,
    }
    return stats
  })

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
    const { rows: [sched] } = await pool.query(
      `select
         (select count(*) from scheduler_state where beat_at > now() - interval '60 seconds')::int as instances,
         (select floor(extract(epoch from now() - max(beat_at)))::int from scheduler_state) as last_beat,
         t.tick_seconds, t.last_sent, t.last_error
       from (select 1) one
       left join lateral (
         select floor(extract(epoch from now() - last_tick_at))::int as tick_seconds, last_sent, last_error
           from scheduler_state where last_tick_at is not null order by last_tick_at desc limit 1
       ) t on true`,
    )
    const { rows: [rt] } = await pool.query(
      `select
         (select count(*) from realtime_state where beat_at > now() - interval '60 seconds')::int as instances,
         coalesce((select sum(connections) from realtime_state where beat_at > now() - interval '60 seconds'), 0)::int as connections,
         (select floor(extract(epoch from now() - max(beat_at)))::int from realtime_state) as last_beat`,
    )
    const count = (channel: 'email' | 'push') => delivery.find((d) => d.channel === channel) ?? { sent: 0, failed: 0 }

    const queue: QueueStats = {
      notifier: { alive: r.instances > 0, instances: r.instances, lastBeatSeconds: r.last_beat },
      waiting: { email: r.waiting_email, push: r.waiting_push },
      retrying: r.retrying,
      oldestSeconds: r.oldest,
      mail: { usedToday: r.mail_used, limit: mailDailyLimit() },
      today: {
        email: { sent: count('email').sent, failed: count('email').failed },
        push: { sent: count('push').sent, failed: count('push').failed },
      },
      scheduler: {
        alive: sched.instances > 0,
        instances: sched.instances,
        lastBeatSeconds: sched.last_beat,
        lastTickSeconds: sched.tick_seconds,
        lastSent: sched.last_sent,
        lastError: sched.last_error,
      },
      realtime: { alive: rt.instances > 0, instances: rt.instances, connections: rt.connections, lastBeatSeconds: rt.last_beat },
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
