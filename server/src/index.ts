import { buildApp } from './app.js'
import { deleteExpiredSessions } from './auth.js'
import { pool } from './db.js'
import { migrate } from './migrate.js'
import { pushEnabled } from './push.js'

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) throw new Error('DATABASE_URL is not set')

await migrate(databaseUrl)
const app = await buildApp()

const port = Number(process.env.PORT ?? 3000)
await app.listen({ port, host: '0.0.0.0' })

if (!pushEnabled) app.log.warn('VAPID keys are not set: push notifications are disabled (run `npm run vapid` in server/)')
// истёкшие сессии удаляем при старте и раз в сутки
const cleanSessions = () => deleteExpiredSessions().catch((err) => app.log.error(err, 'session cleanup failed'))
void cleanSessions()
const sessionCleanup = setInterval(cleanSessions, 24 * 60 * 60 * 1000)
sessionCleanup.unref()

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, async () => {
    await app.close()
    await pool.end()
    process.exit(0)
  })
}
