import type { FastifyInstance } from 'fastify'
import { authenticate } from './auth.js'
import { pool } from './db.js'
import { isValidTimeZone } from './lib/timeZone.js'
import { enqueue, PRIORITY } from './outbox/index.js'

// Серверу нужен только публичный ключ (его просит браузер для подписки). Приватный ключ и отправка у сервиса notifier.
// Без публичного ключа push выключен: маршруты отвечают 503, уведомления не ставятся в очередь.
const publicKey = process.env.VAPID_PUBLIC_KEY

export const pushEnabled = Boolean(publicKey)

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
  app.get('/api/push/config', { config: { public: true } }, async (_req, reply) => {
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

    const { rows } = await pool.query<{ id: string }>('select id from push_subscriptions where member_id = $1', [me.id])
    if (rows.length === 0) return reply.code(404).send({ error: 'no_subscriptions' })

    const message = {
      title: 'Проверка уведомлений',
      body: 'Если вы это видите, уведомления работают ✅',
      url: '/profile/notifications',
      tag: 'test',
    }

    // Отправляет notifier, итог сразу неизвестен: считаем принятые в очередь. Поля sent и failed оставлены, чтобы клиент
    // прежней версии показал «Отправили».
    await Promise.all(
      rows.map((sub) => enqueue(pool, { channel: 'push', priority: PRIORITY.event, payload: { v: 1, subscriptionId: sub.id, message } })),
    )
    return { queued: rows.length, sent: rows.length, failed: 0 }
  })
}
