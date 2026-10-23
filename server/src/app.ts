import rateLimit from '@fastify/rate-limit'
import websocket from '@fastify/websocket'
import Fastify, { type RouteOptions } from 'fastify'
import { authenticate } from './auth.js'
import { adminRoutes } from './admin.js'
import { captchaFromEnv, type CaptchaVerifier } from './captcha.js'
import { chatRoutes } from './chat.js'
import { coinRoutes } from './coins.js'
import { eventRoutes } from './events.js'
import { familyDeletionRoutes } from './familyDeletion.js'
import { goalRoutes } from './goals.js'
import { inviteRoutes } from './invites.js'
import { createMediaClient, mediaEnv, type MediaClient } from './media/client.js'
import { robloxRoutes } from './roblox.js'
import { pushRoutes } from './push.js'
import { MAX_PAYLOAD, realtimeRoutes } from './realtime.js'
import { routes } from './routes.js'
import { scheduleRoutes } from './schedule.js'
import { taskRoutes } from './tasks/routes.js'
import { trainingRoutes } from './trainings.js'

// Маршрут без авторизации помечается config: { public: true }. Все остальные маршруты /api требуют токен: это проверяет общий хук ниже,
// поэтому забытая проверка в новом обработчике не открывает его всем.
declare module 'fastify' {
  interface FastifyContextConfig {
    public?: boolean
  }
}

export const GENERAL_LIMIT_PER_MINUTE = 600

interface Options {
  logger?: boolean
  // вызывается для каждого зарегистрированного маршрута (тест списка открытых маршрутов)
  onRoute?: (route: RouteOptions) => void
  // общий лимит запросов; в тестах выключаем, чтобы они не упирались в лимиты
  rateLimit?: boolean
  // фото в чатах: клиент сервиса media и секрет подписи ссылок; по умолчанию из окружения, null отключает фото
  media?: { client: MediaClient; secret: string } | null
  // капча перед отправкой кода на почту; по умолчанию из окружения (SMARTCAPTCHA_*), null выключает
  captcha?: CaptchaVerifier | null
}

// Собирает приложение, но не запускает его: запуск и планировщик в index.ts, тесты работают через app.inject.
export async function buildApp({ logger = true, rateLimit: limit = true, onRoute, media, captcha }: Options = {}) {
  if (captcha === undefined) captcha = captchaFromEnv()
  if (media === undefined) {
    const env = mediaEnv()
    media = env ? { client: createMediaClient(env), secret: env.secret } : null
  }
  const app = Fastify({
    logger,
    // сервер доступен только через nginx, берём реальный IP клиента из X-Forwarded-For
    trustProxy: true,
  })

  if (onRoute) app.addHook('onRoute', onRoute)

  // фото приходит сырым JPEG (загрузка в чат); предел размера задан у самого маршрута
  app.addContentTypeParser('image/jpeg', { parseAs: 'buffer' }, (_req, body, done) => done(null, body))
  // файл в чат приходит сырыми байтами; размер ограничен у самого маршрута
  app.addContentTypeParser('application/octet-stream', { parseAs: 'buffer' }, (_req, body, done) => done(null, body))

  // Авторизация по умолчанию: без токена отвечаем 401 раньше проверки тела и параметров (иначе схему можно «прощупать» без входа).
  app.addHook('onRequest', async (req, reply) => {
    if (!req.url.startsWith('/api/') || req.routeOptions.config.public) return
    if (!(await authenticate(req))) return reply.code(401).send({ error: 'unauthorized' })
  })

  // Сбои сервера не показывают клиенту внутренний текст ошибки (запросы к базе, пути); ошибки клиента отдаются как обычно.
  app.setErrorHandler((error, req, reply) => {
    const status = (error as { statusCode?: number }).statusCode ?? 500
    if (status >= 500) {
      req.log.error(error)
      return reply.code(status).send({ error: 'internal_error' })
    }
    return reply.send(error)
  })

  // Общий лимит на IP. Семья сидит за одним адресом (домашний Wi-Fi, мобильный оператор), а каждый переход между экранами
  // даёт до десятка запросов, поэтому лимит с запасом: от перебора кодов защищают строгие лимиты отдельных маршрутов (10 в минуту).
  if (limit) await app.register(rateLimit, { max: GENERAL_LIMIT_PER_MINUTE, timeWindow: '1 minute' })
  await app.register(websocket, { options: { maxPayload: MAX_PAYLOAD } })
  await app.register(realtimeRoutes)
  await app.register(routes, { captcha })
  await app.register(inviteRoutes)
  await app.register(scheduleRoutes)
  await app.register(trainingRoutes)
  await app.register(taskRoutes)
  await app.register(pushRoutes)
  await app.register(chatRoutes, { media })
  await app.register(coinRoutes)
  await app.register(robloxRoutes)
  await app.register(goalRoutes)
  await app.register(eventRoutes, { media })
  await app.register(familyDeletionRoutes)
  await app.register(adminRoutes, { media })
  return app
}
