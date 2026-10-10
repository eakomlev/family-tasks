import rateLimit from '@fastify/rate-limit'
import Fastify from 'fastify'
import { pool } from './db.js'
import { migrate } from './migrate.js'
import { startScheduler } from './notifications/scheduler.js'
import { pushEnabled, pushRoutes } from './push.js'
import { routes } from './routes.js'
import { scheduleRoutes } from './schedule.js'
import { taskRoutes } from './tasks/routes.js'
import { trainingRoutes } from './trainings.js'

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) throw new Error('DATABASE_URL is not set')

const app = Fastify({
  logger: true,
  // сервер доступен только через nginx, берём реальный IP клиента из X-Forwarded-For
  trustProxy: true,
})

await migrate(databaseUrl)
await app.register(rateLimit, { max: 120, timeWindow: '1 minute' })
await app.register(routes)
await app.register(scheduleRoutes)
await app.register(trainingRoutes)
await app.register(taskRoutes)
await app.register(pushRoutes)

const port = Number(process.env.PORT ?? 3000)
await app.listen({ port, host: '0.0.0.0' })

if (!pushEnabled) app.log.warn('VAPID keys are not set: push notifications are disabled (run `npm run vapid` in server/)')
const stopScheduler = startScheduler((err) => app.log.error(err, 'notification tick failed'))

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, async () => {
    stopScheduler()
    await app.close()
    await pool.end()
    process.exit(0)
  })
}
