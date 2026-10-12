import type { FastifyInstance } from 'fastify'
import webpush from 'web-push'
import { authenticate } from './auth.js'
import { pool } from './db.js'
import type { PushMessage } from './notifications/messages.js'
import { isValidTimeZone } from './notifications/time.js'

const publicKey = process.env.VAPID_PUBLIC_KEY
const privateKey = process.env.VAPID_PRIVATE_KEY

export const pushEnabled = Boolean(publicKey && privateKey)

if (pushEnabled) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT ?? 'mailto:admin@family-tasks.local',
    publicKey!,
    privateKey!,
  )
}

// Сервер сам делает запрос на адрес из подписки, поэтому принимаем только адреса известных push-сервисов:
// иначе любой участник мог бы заставить сервер обращаться к произвольным https-адресам (SSRF).
// Для тестов можно добавить хосты через PUSH_ALLOWED_HOSTS (через запятую).
const ALLOWED_SUFFIXES = ['.googleapis.com', '.push.services.mozilla.com', '.push.apple.com', '.notify.windows.com']

export function isAllowedEndpoint(endpoint: string): boolean {
  let url: URL
  try {
    url = new URL(endpoint)
  } catch {
    return false
  }
  if (url.protocol !== 'https:') return false
  const extra = (process.env.PUSH_ALLOWED_HOSTS ?? '').split(',').map((h) => h.trim()).filter(Boolean)
  return extra.includes(url.hostname) || ALLOWED_SUFFIXES.some((suffix) => url.hostname.endsWith(suffix))
}

export interface StoredSubscription {
  id: string
  endpoint: string
  p256dh: string
  auth: string
}

export type SendResult = 'sent' | 'gone' | 'failed'

export async function sendPush(sub: StoredSubscription, message: PushMessage): Promise<SendResult> {
  try {
    await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      JSON.stringify(message),
      // если устройство долго недоступно, уведомление уже не нужно
      { TTL: 6 * 60 * 60 },
    )
    return 'sent'
  } catch (err) {
    const status = (err as { statusCode?: number }).statusCode
    // подписка отозвана или устарела: удаляем, чтобы не слать впустую
    if (status === 404 || status === 410) {
      await pool.query('delete from push_subscriptions where id = $1', [sub.id])
      return 'gone'
    }
    console.error('push failed', status ?? '', (err as Error).message)
    return 'failed'
  }
}

// Отправляет уведомление на все устройства участника; ошибки не пробрасываем, чтобы они не ломали основное действие.
export async function notifyMember(memberId: string, message: PushMessage): Promise<void> {
  if (!pushEnabled) return
  try {
    const { rows } = await pool.query(
      'select id, endpoint, p256dh, auth from push_subscriptions where member_id = $1',
      [memberId],
    )
    await Promise.all(rows.map((sub) => sendPush(sub, message)))
  } catch (err) {
    console.error('notify failed', (err as Error).message)
  }
}

const strictLimit = { rateLimit: { max: 10, timeWindow: '1 minute' } }

const subscribeSchema = {
  body: {
    type: 'object',
    required: ['endpoint', 'keys', 'timeZone'],
    additionalProperties: false,
    properties: {
      endpoint: { type: 'string', maxLength: 2048 },
      keys: {
        type: 'object',
        required: ['p256dh', 'auth'],
        additionalProperties: false,
        properties: {
          p256dh: { type: 'string', minLength: 1, maxLength: 256 },
          auth: { type: 'string', minLength: 1, maxLength: 256 },
        },
      },
      timeZone: { type: 'string', minLength: 1, maxLength: 64 },
    },
  },
}

const unsubscribeSchema = {
  body: {
    type: 'object',
    required: ['endpoint'],
    additionalProperties: false,
    properties: { endpoint: { type: 'string', maxLength: 2048 } },
  },
}

export async function pushRoutes(app: FastifyInstance) {
  // публичный ключ нужен браузеру, чтобы оформить подписку
  app.get('/api/push/config', async (_req, reply) => {
    if (!pushEnabled) return reply.code(503).send({ error: 'push_not_configured' })
    return { publicKey }
  })

  app.post<{ Body: { endpoint: string; keys: { p256dh: string; auth: string }; timeZone: string } }>(
    '/api/push/subscriptions',
    { schema: subscribeSchema, config: strictLimit },
    async (req, reply) => {
      const me = await authenticate(req)
      if (!me) return reply.code(401).send({ error: 'unauthorized' })
      if (!pushEnabled) return reply.code(503).send({ error: 'push_not_configured' })

      const { endpoint, keys, timeZone } = req.body
      if (!isAllowedEndpoint(endpoint)) return reply.code(400).send({ error: 'invalid_endpoint' })
      if (!isValidTimeZone(timeZone)) return reply.code(400).send({ error: 'invalid_time_zone' })

      // один и тот же браузер может войти под другим участником: подписка переходит к нему
      await pool.query(
        `insert into push_subscriptions (member_id, endpoint, p256dh, auth, time_zone)
         values ($1, $2, $3, $4, $5)
         on conflict (endpoint) do update
           set member_id = excluded.member_id, p256dh = excluded.p256dh,
               auth = excluded.auth, time_zone = excluded.time_zone`,
        [me.id, endpoint, keys.p256dh, keys.auth, timeZone],
      )
      return reply.code(204).send()
    },
  )

  app.post<{ Body: { endpoint: string } }>(
    '/api/push/unsubscribe',
    { schema: unsubscribeSchema },
    async (req, reply) => {
      const me = await authenticate(req)
      if (!me) return reply.code(401).send({ error: 'unauthorized' })
      await pool.query('delete from push_subscriptions where endpoint = $1 and member_id = $2', [
        req.body.endpoint,
        me.id,
      ])
      return reply.code(204).send()
    },
  )

  // проверка, что уведомления доходят: отправляет тестовое на все устройства участника
  app.post('/api/push/test', { config: strictLimit }, async (req, reply) => {
    const me = await authenticate(req)
    if (!me) return reply.code(401).send({ error: 'unauthorized' })
    if (!pushEnabled) return reply.code(503).send({ error: 'push_not_configured' })

    const { rows } = await pool.query(
      'select id, endpoint, p256dh, auth from push_subscriptions where member_id = $1',
      [me.id],
    )
    if (rows.length === 0) return reply.code(404).send({ error: 'no_subscriptions' })

    const results = await Promise.all(
      rows.map((sub) =>
        sendPush(sub, {
          title: 'Проверка уведомлений',
          body: 'Если вы это видите, уведомления работают ✅',
          url: '/profile/notifications',
          tag: 'test',
        }),
      ),
    )
    return { sent: results.filter((r) => r === 'sent').length, failed: results.filter((r) => r !== 'sent').length }
  })
}
