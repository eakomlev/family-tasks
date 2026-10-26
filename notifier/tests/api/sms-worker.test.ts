import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SmsPayload } from '../../src/contract.js'
import type { Outcome } from '../../src/outcome.js'
import { processBatch, type Providers } from '../../src/worker.js'
import { clearOutbox, clearStats, insertRow, pool, rowById, statsFor } from '../helpers.js'

const NOW = new Date('2026-10-13T10:00:00Z')
const noLog = vi.fn()
const smsPayload = (to = '+79112223344') => ({ v: 1, kind: 'code', to, code: '123456', ttlMinutes: 10 })

function providers(sms: (p: SmsPayload) => Outcome = () => ({ kind: 'sent' })): Providers & { sms: ReturnType<typeof vi.fn> } {
  return {
    email: vi.fn(async () => ({ kind: 'sent' as const })),
    push: vi.fn(async () => ({ kind: 'sent' as const })),
    sms: vi.fn(async (p: SmsPayload) => sms(p)),
  }
}

beforeEach(async () => {
  noLog.mockClear()
  await clearOutbox()
  await clearStats()
})
afterAll(async () => {
  await clearOutbox()
  await pool.end()
})

describe('канал sms в проходе', () => {
  it('отправляет SMS через свой провайдер, строку удаляет, итог идёт в счётчики канала sms', async () => {
    const id = await insertRow({ channel: 'sms', priority: 0, payload: smsPayload() })
    const p = providers()
    const stats = await processBatch(pool, p, { now: NOW, log: noLog })
    expect(p.sms).toHaveBeenCalledWith({ v: 1, kind: 'code', to: '+79112223344', code: '123456', ttlMinutes: 10 })
    expect(p.email).not.toHaveBeenCalled()
    expect(p.push).not.toHaveBeenCalled()
    expect(stats.sent).toBe(1)
    expect(await rowById(id)).toBeUndefined()
    expect(await statsFor()).toEqual([expect.objectContaining({ channel: 'sms', sent: 1, failed: 0 })])
  })

  it('постоянная ошибка провайдера удаляет строку и считается неудачей sms', async () => {
    const id = await insertRow({ channel: 'sms', priority: 0, payload: smsPayload() })
    await processBatch(pool, providers(() => ({ kind: 'fail', error: 'sms 400 Validation error' })), { now: NOW, log: noLog })
    expect(await rowById(id)).toBeUndefined()
    expect(await statsFor()).toEqual([expect.objectContaining({ channel: 'sms', sent: 0, failed: 1 })])
  })

  it('временная ошибка оставляет строку на повтор с короткой паузой (код живёт 10 минут)', async () => {
    const id = await insertRow({ channel: 'sms', priority: 0, payload: smsPayload() })
    await processBatch(pool, providers(() => ({ kind: 'retry', error: 'sms 402 Not enough money' })), { now: NOW, log: noLog })
    const row = await rowById(id)
    expect(row.attempts).toBe(1)
    const waitSeconds = (new Date(row.next_attempt_at).getTime() - NOW.getTime()) / 1000
    expect(waitSeconds).toBeGreaterThan(3)
    expect(waitSeconds).toBeLessThan(10)
  })

  it('битый номер в строке не доходит до провайдера', async () => {
    const id = await insertRow({ channel: 'sms', priority: 0, payload: smsPayload('+380501234567') })
    const p = providers()
    await processBatch(pool, p, { now: NOW, log: noLog })
    expect(p.sms).not.toHaveBeenCalled()
    expect(await rowById(id)).toBeUndefined()
  })
})
