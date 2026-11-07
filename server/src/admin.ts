import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { deleteAdminMember } from './account.js'
import { authenticate } from './auth.js'
import { pool } from './db.js'
import type { MediaClient } from './media/client.js'
import { mediaQuotaBytes } from './media/index.js'
import { mailDailyLimit, smsDailyLimit } from './outbox/budget.js'
import { closeSessionHash, publish } from './realtime.js'

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

async function requireAdmin(req: FastifyRequest, reply: FastifyReply) {
  const me = await authenticate(req)
  if (!me) { await reply.code(401).send({ error: 'unauthorized' }); return null }
  if (!isAdminEmail(me.email)) { await reply.code(404).send({ error: 'not_found' }); return null }
  return me
}

const accountListSchema = {
  querystring: {
    type: 'object', additionalProperties: false,
    properties: {
      search: { type: 'string', maxLength: 100 },
      page: { type: 'integer', minimum: 1, maximum: 100000 },
      pageSize: { type: 'integer', minimum: 1, maximum: 100 },
    },
  },
}
const accountIdSchema = { params: { type: 'object', required: ['id'], additionalProperties: false, properties: { id: { type: 'string', format: 'uuid' } } } }
const blockBodySchema = { body: { type: 'object', required: ['blocked'], additionalProperties: false, properties: { blocked: { type: 'boolean' } } } }

export interface AdminAccountRow {
  id: string
  name: string
  email: string | null
  phone: string | null
  role: string
  isOwner: boolean
  createdAt: string
  blockedAt: string | null
  accessBlocked: boolean
  family: { id: string; code: string; surname: string | null } | null
  familyDeletionRequestedAt: string | null
}

export async function adminRoutes(app: FastifyInstance, { media = null }: Partial<AdminOptions> = {}) {
  // Список участников аккаунтов с поиском и постраничной выдачей. Профили разных семей считаются отдельными аккаунтами.
  app.get<{ Querystring: { search?: string; page?: number; pageSize?: number } }>(
    '/api/admin/accounts', { schema: accountListSchema }, async (req, reply) => {
      if (!(await requireAdmin(req, reply))) return
      const search = req.query.search?.trim() ?? ''
      const pattern = `%${search}%`
      const page = req.query.page ?? 1
      const pageSize = req.query.pageSize ?? 25
      const offset = (page - 1) * pageSize
      const where = `($1 = '' or m.name ilike $2 or coalesce(m.email, '') ilike $2 or coalesce(m.phone, '') ilike $2
        or coalesce(f.code, '') ilike $2 or coalesce(f.surname, '') ilike $2)`
      const { rows: [count] } = await pool.query<{ total: number }>(
        `select count(*)::int as total from members m left join families f on f.id = m.family_id where ${where}`,
        [search, pattern],
      )
      const { rows } = await pool.query<AdminAccountRow>(
        `select m.id, m.name, m.email, m.phone, m.role, m.is_owner as "isOwner",
           to_char(m.created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as "createdAt",
           to_char(m.blocked_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as "blockedAt",
           (m.blocked_at is not null or exists (
             select 1 from members b where b.blocked_at is not null
               and ((m.email is not null and b.email = m.email) or (m.phone is not null and b.phone = m.phone))
           )) as "accessBlocked",
           case when f.id is null then null else json_build_object('id', f.id, 'code', f.code, 'surname', f.surname) end as family,
           to_char(fd.requested_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as "familyDeletionRequestedAt"
         from members m left join families f on f.id = m.family_id
         left join family_deletions fd on fd.family_id = f.id
         where ${where}
         order by m.created_at desc, m.id limit $3 offset $4`,
        [search, pattern, pageSize, offset],
      )
      return { items: rows, total: count.total, page, pageSize }
    },
  )

  // Полная карточка аккаунта: профиль, семья, согласие, активность и число устройств.
  app.get<{ Params: { id: string } }>(
    '/api/admin/accounts/:id', { schema: accountIdSchema }, async (req, reply) => {
      if (!(await requireAdmin(req, reply))) return
      const { rows } = await pool.query(
        `select m.id, m.name, m.email, m.phone, m.role, m.is_owner as "isOwner", m.avatar,
           to_char(m.birth_date, 'YYYY-MM-DD') as "birthDate",
           case when m.mood is not null then json_build_object('value', m.mood, 'at', m.mood_at) end as mood,
           to_char(m.created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as "createdAt",
           to_char(m.blocked_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as "blockedAt",
           (m.blocked_at is not null or exists (
             select 1 from members b where b.blocked_at is not null
               and ((m.email is not null and b.email = m.email) or (m.phone is not null and b.phone = m.phone))
           )) as "accessBlocked",
           m.consent_version as "consentVersion",
           to_char(m.consent_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as "consentAt",
           m.family_id as "familyId", f.code as "familyCode", f.surname as "familySurname",
           to_char(fd.requested_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as "familyDeletionRequestedAt",
           (select count(*)::int from sessions s where s.member_id = m.id) as "sessionCount",
           to_char((select max(s.last_used_at) from sessions s where s.member_id = m.id) at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as "lastSeenAt",
           (select count(*)::int from push_subscriptions p where p.member_id = m.id) as "pushCount",
           (select count(*)::int from tasks t where t.author_id = m.id) as "tasksCreated",
           (select count(*)::int from tasks t where t.assignee_id = m.id) as "tasksAssigned",
           (select count(*)::int from task_completions tc where tc.done_by = m.id) as "tasksCompleted",
           (select count(*)::int from messages msg where msg.sender_id = m.id) as "messagesSent",
           (select count(*)::int from events e where e.author_id = m.id) as "eventsCreated",
           (select count(*)::int from goals g where g.member_id = m.id) as "goals",
           (select count(*)::int from games g where g.inviter_id = m.id or g.invitee_id = m.id) as "games",
           (select count(*)::int from coin_transactions c where c.member_id = m.id) as "coinTransactions"
         from members m left join families f on f.id = m.family_id
         left join family_deletions fd on fd.family_id = f.id where m.id = $1`,
        [req.params.id],
      )
      const account = rows[0]
      if (!account) return reply.code(404).send({ error: 'account_not_found' })
      const related = await pool.query(
        `select members.id, members.name, members.role, members.is_owner as "isOwner", members.email, members.phone,
           to_char(members.created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as "createdAt",
           f.code as "familyCode", f.surname as "familySurname",
           (blocked_at is not null or exists (
             select 1 from members b where b.blocked_at is not null
               and ((members.email is not null and b.email = members.email) or (members.phone is not null and b.phone = members.phone))
           )) as "accessBlocked"
         from members left join families f on f.id = members.family_id where members.id <> $1
           and (members.email = $2 or members.phone = $3)
         order by members.created_at desc`,
        [req.params.id, account.email, account.phone],
      )
      const familyMembers = account.familyId ? await pool.query(
        `select id, name, role, is_owner as "isOwner", email, phone,
           to_char(created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as "createdAt",
           (blocked_at is not null or exists (
             select 1 from members b where b.blocked_at is not null
               and ((members.email is not null and b.email = members.email) or (members.phone is not null and b.phone = members.phone))
           )) as "accessBlocked"
         from members where family_id = $1 order by is_owner desc, created_at`,
        [account.familyId],
      ) : { rows: [] }
      return {
        ...account,
        relatedAccounts: related.rows,
        familyMembers: familyMembers.rows,
      }
    },
  )

  // Блокировка отзывает все активные сессии с этим email/телефоном и закрывает открытые WebSocket-соединения.
  app.patch<{ Params: { id: string }; Body: { blocked: boolean } }>(
    '/api/admin/accounts/:id', { schema: { ...accountIdSchema, ...blockBodySchema } }, async (req, reply) => {
      const admin = await requireAdmin(req, reply)
      if (!admin) return
      const db = await pool.connect()
      let sessionHashes: string[] = []
      let familyId: string | null = null
      try {
        await db.query('begin')
        const { rows } = await db.query<{ id: string; email: string | null; phone: string | null; blocked_at: string | null; family_id: string | null }>(
          `select id, email, phone, blocked_at, family_id from members where id = $1`, [req.params.id],
        )
        const target = rows[0]
        if (!target) { await db.query('rollback'); return reply.code(404).send({ error: 'account_not_found' }) }
        if (target.id === admin.id || target.email === admin.email || (target.phone && target.phone === admin.phone)) {
          await db.query('rollback')
          return reply.code(400).send({ error: 'cannot_block_self' })
        }
        const contactSql = `((email is not null and email = $1) or (phone is not null and phone = $2))`
        // Блокируется вход по тем же контактам во всех семьях, где они используются.
        await db.query(`select id from members where ${contactSql} order by id for update`, [target.email, target.phone])
        const lockedTarget = await db.query<{ family_id: string | null }>('select family_id from members where id = $1 for update', [target.id])
        if (!lockedTarget.rows[0]) { await db.query('rollback'); return reply.code(404).send({ error: 'account_not_found' }) }
        if (req.body.blocked) {
          await db.query('update members set blocked_at = coalesce(blocked_at, now()) where id = $1', [target.id])
          const sessions = await db.query<{ token_hash: string }>(
            `select s.token_hash from sessions s join members m on m.id = s.member_id where ${contactSql}`,
            [target.email, target.phone],
          )
          sessionHashes = sessions.rows.map((session) => session.token_hash)
          await db.query(`delete from sessions s using members m where s.member_id = m.id and ${contactSql}`, [target.email, target.phone])
          familyId = lockedTarget.rows[0].family_id
        } else {
          await db.query('update members set blocked_at = null where id = $1', [target.id])
        }
        await db.query('commit')
      } catch (error) {
        await db.query('rollback').catch(() => {})
        throw error
      } finally {
        db.release()
      }
      for (const sessionHash of sessionHashes) closeSessionHash(sessionHash)
      if (familyId) publish(familyId, { type: 'members' })
      return reply.code(200).send({ blocked: req.body.blocked })
    },
  )

  // Для обычного участника данные удаляются сразу; удаление создателя ставит всю семью в существующую очередь очистки.
  app.delete<{ Params: { id: string } }>(
    '/api/admin/accounts/:id', { schema: accountIdSchema, config: { rateLimit: { max: 5, timeWindow: '1 minute' } } }, async (req, reply) => {
      const admin = await requireAdmin(req, reply)
      if (!admin) return
      if (req.params.id === admin.id) return reply.code(400).send({ error: 'cannot_delete_self' })
      const { rows } = await pool.query<{ id: string; family_id: string | null; is_owner: boolean }>(
        'select id, family_id, is_owner from members where id = $1', [req.params.id],
      )
      const target = rows[0]
      if (!target) return reply.code(404).send({ error: 'account_not_found' })
      if (target.is_owner && target.family_id) {
        const db = await pool.connect()
        let sessionHashes: string[] = []
        let requestedAt = ''
        try {
          await db.query('begin')
          await db.query('select id from families where id = $1 for update', [target.family_id])
          const { rows: deletion } = await db.query<{ requested_at: string }>(
            `insert into family_deletions (family_id, requested_by) values ($1, null)
             on conflict (family_id) do update set family_id = excluded.family_id
             returning requested_at`, [target.family_id],
          )
          requestedAt = deletion[0].requested_at
          const sessions = await db.query<{ token_hash: string }>(
            'select s.token_hash from sessions s join members m on m.id = s.member_id where m.family_id = $1', [target.family_id],
          )
          sessionHashes = sessions.rows.map((session) => session.token_hash)
          await db.query('commit')
        } catch (error) {
          await db.query('rollback').catch(() => {})
          throw error
        } finally { db.release() }
        for (const sessionHash of sessionHashes) closeSessionHash(sessionHash)
        return reply.code(202).send({ deletionRequestedAt: requestedAt, familyDeletion: true })
      }
      const result = await deleteAdminMember(req, media, req.params.id)
      if (result === 'not_found') return reply.code(404).send({ error: 'account_not_found' })
      if (result === 'owner') return reply.code(409).send({ error: 'owner_family_required' })
      return reply.code(204).send()
    },
  )

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
