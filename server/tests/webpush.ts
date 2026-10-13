import { pool } from '../src/db.js'

// Отправку push делает отдельный сервис notifier, server только ставит сообщения в очередь outbox
// (в тестах включён QUEUE_ENABLED=true, vitest.config.ts). Поэтому «отправленное» здесь это строки очереди.
export interface Sent {
  endpoint: string
  payload: { title: string; body: string; url: string; tag: string }
}

// Адреса, подписанные через subscribe() этим файлом тестов: по ним очищаем очередь, не задевая параллельные файлы.
const mine = new Set<string>()

// Всё, что поставлено в очередь для указанных адресов (чужие адреса от параллельных тестов игнорируем).
export async function sentTo(endpoints: string[]): Promise<Sent[]> {
  const { rows } = await pool.query(
    `select s.endpoint, o.payload->'message' as message
       from outbox o join push_subscriptions s on s.id = (o.payload->>'subscriptionId')::uuid
      where o.channel = 'push' and s.endpoint = any($1)
      order by o.id`,
    [endpoints],
  )
  return rows.map((r) => ({ endpoint: r.endpoint, payload: r.message }))
}

// Забывает всё поставленное в очередь для подписок этого файла (между тестами).
export async function resetSent(): Promise<void> {
  await pool.query(
    `delete from outbox o using push_subscriptions s
      where o.channel = 'push' and s.id = (o.payload->>'subscriptionId')::uuid and s.endpoint = any($1)`,
    [[...mine]],
  )
}

// Подписка участника на уведомления; endpoint уникален, чтобы тесты не мешали друг другу.
export async function subscribe(memberId: string, timeZone = 'UTC'): Promise<string> {
  const endpoint = `https://push.test/${memberId}`
  mine.add(endpoint)
  await pool.query(
    `insert into push_subscriptions (member_id, endpoint, p256dh, auth, time_zone) values ($1, $2, 'p256dh', 'auth', $3)
     on conflict (endpoint) do update set time_zone = excluded.time_zone`,
    [memberId, endpoint, timeZone],
  )
  return endpoint
}
