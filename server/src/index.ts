import Fastify from 'fastify'
import { pool } from './db.js'
import { migrate } from './migrate.js'
import { routes } from './routes.js'

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) throw new Error('DATABASE_URL is not set')

const app = Fastify({ logger: true })

await migrate(databaseUrl)
await app.register(routes)

const port = Number(process.env.PORT ?? 3000)
await app.listen({ port, host: '0.0.0.0' })

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, async () => {
    await app.close()
    await pool.end()
    process.exit(0)
  })
}
