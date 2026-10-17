import { hostname } from 'node:os'
import { createPool } from './db.js'
import { mediaCleanerFromEnv, runFamilyDeletionsAsLeader } from './familyDeletion.js'
import { log } from './log.js'
import { beat, recordTick } from './state.js'
import { runTickAsLeader } from './tick.js'

const TICK_MS = 60_000
const FIRST_TICK_MS = 5_000
const BEAT_MS = 15_000

const instance = hostname()
const pool = createPool()

// Без публичного ключа VAPID уведомления выключены (как у server): notifier всё равно отбросил бы такие сообщения.
const enabled = Boolean(process.env.VAPID_PUBLIC_KEY)
if (!enabled) log('warn', 'push_disabled', { hint: 'VAPID_PUBLIC_KEY is not set: nothing will be planned' })

// Файлы удаляемых семей убирает сервис media (без его настроек удалять в хранилище нечего)
const media = mediaCleanerFromEnv()

let running = false
const tick = async () => {
  // если предыдущий проход затянулся, новый пропускаем
  if (running) return
  running = true
  const now = new Date()
  try {
    // плановые уведомления: без ключа VAPID выключены
    if (enabled) {
      try {
        const result = await runTickAsLeader(pool, now)
        if (result.leader) await recordTick(pool, instance, now, result.sent, null)
      } catch (err) {
        const e = err as { code?: string; message: string }
        // server ещё не применил миграции (первый запуск): подождём
        log(e.code === '42P01' ? 'warn' : 'error', e.code === '42P01' ? 'waiting_for_migrations' : 'tick_failed', { error: e.message })
        await recordTick(pool, instance, now, 0, e.message).catch(() => {})
      }
    }
    // заявки на удаление семей: независимо от уведомлений, сбой одного не мешает другому
    try {
      await runFamilyDeletionsAsLeader(pool, media, now)
    } catch (err) {
      const e = err as { code?: string; message: string }
      if (e.code !== '42P01') log('error', 'family_deletions_failed', { error: e.message })
    }
  } finally {
    running = false
  }
}

const beatTimer = setInterval(() => {
  beat(pool, instance, new Date()).catch((err) => log('warn', 'heartbeat_failed', { error: (err as Error).message }))
}, BEAT_MS)
void beat(pool, instance, new Date()).catch(() => {})
const tickTimer = setInterval(tick, TICK_MS)
const firstTimer = setTimeout(tick, FIRST_TICK_MS)

log('info', 'scheduler_started', { instance, enabled, media: media !== null })

await new Promise<void>((resolve) => {
  for (const signal of ['SIGINT', 'SIGTERM'] as const) process.on(signal, () => resolve())
})

clearInterval(beatTimer)
clearInterval(tickTimer)
clearTimeout(firstTimer)
// дожидаемся текущего прохода
while (running) await new Promise((r) => setTimeout(r, 100))
await pool.end()
log('info', 'scheduler_stopped', { instance })
