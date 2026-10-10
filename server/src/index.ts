import Fastify from 'fastify'
import { pool } from './db.js'

const app = Fastify({ logger: true })

app.get('/api/health', async (_req, reply) => {
  try {
    await pool.query('select 1')
    return { status: 'ok' }
  } catch (err) {
    app.log.error(err)
    return reply.code(503).send({ status: 'db_unavailable' })
  }
})

const port = Number(process.env.PORT ?? 3000)
await app.listen({ port, host: '0.0.0.0' })

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, async () => {
    await app.close()
    await pool.end()
    process.exit(0)
  })
}
