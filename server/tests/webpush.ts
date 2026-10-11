import { vi } from 'vitest'
import webpush from 'web-push'
import { pool } from '../src/db.js'

// Подмена библиотеки web-push (подключается в тестах через vi.mock('web-push', ...)):
// настоящих запросов к push-сервисам нет, отправленное можно проверять.
export const sendNotification = vi.mocked(webpush.sendNotification)

export interface Sent {
  endpoint: string
  payload: { title: string; body: string; url: string; tag: string }
}

// Всё, что «отправлено» на указанные адреса (чужие адреса от параллельных тестов игнорируем).
export function sentTo(endpoints: string[]): Sent[] {
  return sendNotification.mock.calls
    .filter(([sub]) => endpoints.includes((sub as { endpoint: string }).endpoint))
    .map(([sub, payload]) => ({
      endpoint: (sub as { endpoint: string }).endpoint,
      payload: JSON.parse(String(payload)),
    }))
}

// Подписка участника на уведомления; endpoint уникален, чтобы тесты не мешали друг другу.
export async function subscribe(memberId: string, timeZone = 'UTC'): Promise<string> {
  const endpoint = `https://push.test/${memberId}`
  await pool.query(
    `insert into push_subscriptions (member_id, endpoint, p256dh, auth, time_zone) values ($1, $2, 'p256dh', 'auth', $3)
     on conflict (endpoint) do update set time_zone = excluded.time_zone`,
    [memberId, endpoint, timeZone],
  )
  return endpoint
}
