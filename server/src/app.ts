import rateLimit from '@fastify/rate-limit'
import websocket from '@fastify/websocket'
import Fastify from 'fastify'
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

interface Options {
  logger?: boolean
  // общий лимит запросов; в тестах выключаем, чтобы они не упирались в лимиты
  rateLimit?: boolean
}

// Собирает приложение, но не запускает его: запуск и планировщик в index.ts, тесты работают через app.inject.
export async function buildApp({ logger = true, rateLimit: limit = true }: Options = {}) {
  const app = Fastify({
    logger,
    // сервер доступен только через nginx, берём реальный IP клиента из X-Forwarded-For
    trustProxy: true,
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
