import { buildApp } from './app.js'
import { pool } from './db.js'
import { migrate } from './migrate.js'
import { startScheduler } from './notifications/scheduler.js'
import { pushEnabled } from './push.js'

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) throw new Error('DATABASE_URL is not set')

await migrate(databaseUrl)
const app = await buildApp()

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
