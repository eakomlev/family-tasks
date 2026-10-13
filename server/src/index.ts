import { buildApp } from './app.js'
import { deleteExpiredSessions } from './auth.js'
import { pool } from './db.js'
import { createMediaClient, mediaEnv } from './media/client.js'
import { deleteOrphanMedia } from './media/cleanup.js'
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
// фото, загруженные и не прикреплённые к сообщению, убираем при старте и раз в сутки
const media = mediaEnv()
if (media) {
  const client = createMediaClient(media)
  const cleanMedia = () =>
    deleteOrphanMedia(pool, client, new Date(), (err) => app.log.error(err, 'media cleanup failed')).catch((err) => app.log.error(err, 'media cleanup failed'))
  void cleanMedia()
  const mediaCleanup = setInterval(cleanMedia, 24 * 60 * 60 * 1000)
  mediaCleanup.unref()
} else {
  app.log.warn('MEDIA_SECRET or MEDIA_INTERNAL_TOKEN is not set: photos in chats are disabled')
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, async () => {
    await app.close()
    await pool.end()
    process.exit(0)
  })
}
