import { hostname } from 'node:os'
import { createPool } from './db.js'
import { createDailyBudget, createPushGate, limitMail, TokenBucket } from './limits.js'
import { startListener } from './listener.js'
import { log } from './log.js'
import { mailProviderFromEnv } from './providers/mail.js'
import { pushProviderFromEnv } from './providers/webpush.js'
import { beat, housekeeping } from './queue.js'
import { processBatch } from './worker.js'

const num = (name: string, fallback: number) => {
  const value = Number(process.env[name])
  return Number.isFinite(value) && value > 0 ? value : fallback
}

// Неотрицательное число из окружения (0 допустим: для MAIL_DAILY_LIMIT это «без лимита»).
const limitNum = (name: string, fallback: number) => {
  const raw = process.env[name]
  if (raw === undefined || raw === '') return fallback
  const value = Number(raw)
  return Number.isFinite(value) && value >= 0 ? value : fallback
}

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) throw new Error('DATABASE_URL is not set')

const BATCH = num('NOTIFIER_BATCH_SIZE', 20)
const CONCURRENCY = num('NOTIFIER_CONCURRENCY', 5)
const LEASE_SECONDS = num('NOTIFIER_LEASE_SECONDS', 60)
const POLL_MS = 1000
const BEAT_MS = 15_000

// Лимиты провайдеров. Скорость считается на экземпляр: при нескольких notifier поделите её между ними.
// Дневной бюджет почты общий (счётчик в БД). Сутки по UTC.
const MAIL_DAILY_LIMIT = limitNum('MAIL_DAILY_LIMIT', 2800)
const MAIL_RATE = Math.max(0.1, limitNum('MAIL_RATE_PER_SECOND', 2))
const PUSH_RATE = Math.max(0.1, limitNum('PUSH_RATE_PER_SECOND', 50))

const instance = hostname()
const pool = createPool()
const providers = {
  email: limitMail(mailProviderFromEnv(), {
    gate: new TokenBucket(MAIL_RATE, Math.max(1, MAIL_RATE)),
    budget: createDailyBudget(pool, 'mail', MAIL_DAILY_LIMIT),
    limit: MAIL_DAILY_LIMIT,
    log,
  }),
  push: pushProviderFromEnv(pool, { gate: createPushGate(PUSH_RATE), log }),
}
if (!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY)) {
  log('warn', 'push_disabled', { hint: 'VAPID keys are not set: push messages will be dropped' })
}

// Ожидание: до сигнала из очереди или до таймера, что наступит раньше.
let wake: (() => void) | undefined
const sleep = (ms: number) =>
  new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, ms)
    wake = () => {
      clearTimeout(timer)
      resolve()
    }
  })

let stopping = false
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    stopping = true
    wake?.()
  })
}
const listener = startListener(databaseUrl, () => wake?.(), log)

const beatTimer = setInterval(() => {
  const now = new Date()
  beat(pool, instance, now)
    .then(() => housekeeping(pool, now))
    .catch((err) => log('warn', 'heartbeat_failed', { error: (err as Error).message }))
}, BEAT_MS)
void beat(pool, instance, new Date()).catch(() => {})

log('info', 'notifier_started', {
  instance,
  batch: BATCH,
  concurrency: CONCURRENCY,
  mailDailyLimit: MAIL_DAILY_LIMIT,
  mailRatePerSecond: MAIL_RATE,
  pushRatePerSecond: PUSH_RATE,
})

while (!stopping) {
  try {
    const stats = await processBatch(pool, providers, { limit: BATCH, concurrency: CONCURRENCY, leaseSeconds: LEASE_SECONDS })
    // пачка была полной: вероятно, есть ещё, не ждём
    if (stats.claimed >= BATCH) continue
  } catch (err) {
    const e = err as { code?: string; message: string }
    // сервер ещё не применил миграции (первый запуск): подождём
    log(e.code === '42P01' ? 'warn' : 'error', e.code === '42P01' ? 'waiting_for_migrations' : 'batch_failed', { error: e.message })
    await sleep(5000)
    continue
  }
  await sleep(POLL_MS)
}

clearInterval(beatTimer)
await listener.close()
await pool.end()
log('info', 'notifier_stopped', { instance })
