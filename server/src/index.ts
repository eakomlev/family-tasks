import rateLimit from '@fastify/rate-limit'
import Fastify from 'fastify'
import { pool } from './db.js'
import { migrate } from './migrate.js'
import { routes } from './routes.js'
import { scheduleRoutes } from './schedule.js'

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

const port = Number(process.env.PORT ?? 3000)
await app.listen({ port, host: '0.0.0.0' })

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, async () => {
    await app.close()
    await pool.end()
    process.exit(0)
  })
}
