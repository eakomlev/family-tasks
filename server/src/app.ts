import rateLimit from '@fastify/rate-limit'
import websocket from '@fastify/websocket'
import Fastify, { type RouteOptions } from 'fastify'
import { authenticate } from './auth.js'
import { chatRoutes } from './chat.js'
import { coinRoutes } from './coins.js'
import { goalRoutes } from './goals.js'
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

interface Options {
  logger?: boolean
  // вызывается для каждого зарегистрированного маршрута (тест списка открытых маршрутов)
  onRoute?: (route: RouteOptions) => void
  // общий лимит запросов; в тестах выключаем, чтобы они не упирались в лимиты
  rateLimit?: boolean
}

// Собирает приложение, но не запускает его: запуск и планировщик в index.ts, тесты работают через app.inject.
export async function buildApp({ logger = true, rateLimit: limit = true, onRoute }: Options = {}) {
  const app = Fastify({
    logger,
    // сервер доступен только через nginx, берём реальный IP клиента из X-Forwarded-For
    trustProxy: true,
  })

  if (onRoute) app.addHook('onRoute', onRoute)

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

  if (limit) await app.register(rateLimit, { max: 120, timeWindow: '1 minute' })
  await app.register(websocket, { options: { maxPayload: MAX_PAYLOAD } })
  await app.register(realtimeRoutes)
  await app.register(routes)
  await app.register(scheduleRoutes)
  await app.register(trainingRoutes)
  await app.register(taskRoutes)
  await app.register(pushRoutes)
  await app.register(chatRoutes)
  await app.register(coinRoutes)
  await app.register(robloxRoutes)
  await app.register(goalRoutes)
  return app
}
