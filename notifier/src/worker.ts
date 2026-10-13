import { parsePayload, type EmailPayload, type PushPayload } from './contract.js'
import type { Db } from './db.js'
import { log as defaultLog, type Log } from './log.js'
import type { Outcome } from './outcome.js'
import { claim, complete, defer, reap, reschedule, type Row } from './queue.js'
import { backoffSeconds, MAX_ATTEMPTS } from './retry.js'

export interface Providers {
  email(payload: EmailPayload): Promise<Outcome>
  push(payload: PushPayload): Promise<Outcome>
}

export interface BatchOptions {
  now?: Date
  limit?: number
  concurrency?: number
  leaseSeconds?: number
  log?: Log
}

export interface BatchStats {
  claimed: number
  sent: number
  retried: number
  failed: number
  skipped: number
  deferred: number
  reaped: number
}

// Через сколько секунд снова предложить строку, формат которой этот notifier не понимает.
const DEFER_SECONDS = 60

// Один проход: убирает отжившее, забирает пачку, отправляет с ограничением параллелизма и записывает итог.
// now передаётся параметром, чтобы проход можно было проверить на любом времени.
export async function processBatch(db: Db, providers: Providers, options: BatchOptions = {}): Promise<BatchStats> {
  const { now = new Date(), limit = 20, concurrency = 5, leaseSeconds = 60, log = defaultLog } = options
  const stats: BatchStats = { claimed: 0, sent: 0, retried: 0, failed: 0, skipped: 0, deferred: 0, reaped: 0 }

  for (const gone of await reap(db, now)) {
    stats.reaped++
    log('error', gone.reason === 'expired' ? 'outbox_expired' : 'outbox_failed', {
      id: gone.id,
      channel: gone.channel,
      attempts: gone.attempts,
      error: gone.lastError,
      reason: gone.reason,
    })
  }

  const rows = await claim(db, now, limit, leaseSeconds)
  stats.claimed = rows.length

  const queue = [...rows]
  const workers = Array.from({ length: Math.min(concurrency, rows.length) }, async () => {
    for (let row = queue.shift(); row; row = queue.shift()) await handle(row)
  })
  await Promise.all(workers)
  return stats

  async function handle(row: Row) {
    const parsed = parsePayload(row.channel, row.payload)
    if (!parsed.ok) {
      if (parsed.reason === 'unsupported_version') {
        stats.deferred++
        log('warn', 'outbox_unsupported_version', { id: row.id, channel: row.channel })
        await defer(db, row.id, now, DEFER_SECONDS)
        return
      }
      return fail(row, `invalid payload: ${parsed.detail}`)
    }

    let outcome: Outcome
    try {
      outcome = parsed.channel === 'email' ? await providers.email(parsed.payload) : await providers.push(parsed.payload)
    } catch (err) {
      outcome = { kind: 'retry', error: (err as Error).message }
    }

    switch (outcome.kind) {
      case 'sent':
        stats.sent++
        await complete(db, row.id)
        return
      case 'skip':
        stats.skipped++
        await complete(db, row.id)
        return
      case 'defer':
        // упёрлись в лимит: попытку не тратим, строку предложим снова позже
        stats.deferred++
        await defer(db, row.id, now, outcome.seconds)
        return
      case 'fail':
        return fail(row, outcome.error)
      case 'retry':
        // attempts уже учитывает эту попытку
        if (row.attempts >= MAX_ATTEMPTS) return fail(row, outcome.error)
        stats.retried++
        await reschedule(db, row.id, now, backoffSeconds(row.channel, row.attempts, outcome.retryAfterSeconds), outcome.error)
        return
    }
  }

  // Окончательная неудача: строку не храним, причина остаётся только в журнале.
  async function fail(row: Row, error: string) {
    stats.failed++
    log('error', 'outbox_failed', { id: row.id, channel: row.channel, attempts: row.attempts, error })
    await complete(db, row.id)
  }
}
