import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SmsPayload } from '../../src/contract.js'
import type { Outcome } from '../../src/outcome.js'
import type { Fetcher } from '../../src/providers/sms.js'
import { BALANCE_PROVIDER, fetchSmsBalance, refreshSmsBalance } from '../../src/smsBalance.js'
import { processBatch, type Providers } from '../../src/worker.js'
import { clearOutbox, clearStats, insertRow, pool } from '../helpers.js'

const NOW = new Date('2026-10-13T10:00:00Z')
const noLog = vi.fn()
const config = { email: 'me@test.local', apiKey: 'key-123', sign: 'SMS Aero' }
const answer = (status: number, body: object | string) => ({ status, text: async () => (typeof body === 'string' ? body : JSON.stringify(body)) })
const balanceRow = async () => (await pool.query('select balance::float8, currency, error, checked_at from provider_balance where provider = $1', [BALANCE_PROVIDER])).rows[0]
const smsStats = async () => (await pool.query(`select sent, failed, spend::float8 from delivery_stats where channel = 'sms' order by day`)).rows

beforeEach(async () => {
  noLog.mockClear()
  await clearOutbox()
  await clearStats()
  await pool.query('delete from provider_balance')
})
afterAll(async () => {
  await clearOutbox()
  await clearStats()
  await pool.query('delete from provider_balance')
  await pool.end()
})

describe('расход на SMS в счётчиках', () => {
  const providers = (sms: (p: SmsPayload) => Outcome): Providers => ({
    email: vi.fn(async () => ({ kind: 'sent' as const })),
    push: vi.fn(async () => ({ kind: 'sent' as const })),
    sms: vi.fn(async (p: SmsPayload) => sms(p)),
  })
  const payload = (n: number) => ({ v: 1, kind: 'code', to: `+7915000000${n}`, code: '123456', ttlMinutes: 10 })

  it('стоимость отправленных суммируется за сутки и накапливается между проходами', async () => {
    await insertRow({ channel: 'sms', priority: 0, payload: payload(1) })
    await insertRow({ channel: 'sms', priority: 0, payload: payload(2) })
    await processBatch(pool, providers(() => ({ kind: 'sent', cost: 9.89 })), { now: NOW, log: noLog })
    expect(await smsStats()).toEqual([{ sent: 2, failed: 0, spend: 19.78 }])

    await insertRow({ channel: 'sms', priority: 0, payload: payload(3) })
    await processBatch(pool, providers(() => ({ kind: 'sent', cost: 9.89 })), { now: NOW, log: noLog })
    expect(await smsStats()).toEqual([{ sent: 3, failed: 0, spend: 29.67 }])
  })

  it('без стоимости в ответе расход не растёт, неудача расхода не даёт', async () => {
    await insertRow({ channel: 'sms', priority: 0, payload: payload(4) })
    await insertRow({ channel: 'sms', priority: 0, payload: payload(5) })
    let n = 0
    await processBatch(pool, providers(() => (n++ === 0 ? { kind: 'sent' } : { kind: 'fail', error: 'sms 400' })), { now: NOW, log: noLog })
    expect(await smsStats()).toEqual([{ sent: 1, failed: 1, spend: 0 }])
  })

  it('у почты и push расход всегда ноль', async () => {
    await insertRow({ channel: 'email', payload: { v: 1, kind: 'code', to: 'a@test.local', code: '123456', ttlMinutes: 10 } })
    await processBatch(pool, providers(() => ({ kind: 'sent' })), { now: NOW, log: noLog })
    const { rows } = await pool.query(`select channel, spend::float8 from delivery_stats`)
    expect(rows).toEqual([{ channel: 'email', spend: 0 }])
  })
})

describe('остаток на счёте SMS Aero', () => {
  it('разбирает ответ шлюза и считает ошибки', async () => {
    const ok = vi.fn<Fetcher>(async () => answer(200, { success: true, data: { balance: 530.22 } }))
    expect(await fetchSmsBalance(config, ok)).toEqual({ ok: true, balance: 530.22 })
    const [url, init] = ok.mock.calls[0]
    expect(url).toBe('https://gate.smsaero.ru/v2/balance')
    expect(init.headers.authorization).toBe(`Basic ${Buffer.from('me@test.local:key-123').toString('base64')}`)

    expect(await fetchSmsBalance(config, async () => answer(200, { success: true, data: { balance: '12.5' } }))).toEqual({ ok: true, balance: 12.5 })
    expect(await fetchSmsBalance(config, async () => answer(401, { success: false, message: 'Unauthorized' }))).toMatchObject({ ok: false, error: expect.stringContaining('Unauthorized') })
    expect(await fetchSmsBalance(config, async () => answer(502, '<html>bad gateway</html>'))).toMatchObject({ ok: false })
    expect(await fetchSmsBalance(config, async () => answer(200, { success: true, data: {} }))).toMatchObject({ ok: false })
    expect(
      await fetchSmsBalance(config, async () => {
        throw new Error('socket hang up')
      }),
    ).toMatchObject({ ok: false, error: expect.stringContaining('socket hang up') })
  })

  it('удачная проверка записывает остаток и время, повторная обновляет', async () => {
    await refreshSmsBalance(pool, config, async () => answer(200, { success: true, data: { balance: 530.22 } }))
    expect(await balanceRow()).toMatchObject({ balance: 530.22, currency: 'RUB', error: null })
    await refreshSmsBalance(pool, config, async () => answer(200, { success: true, data: { balance: 520.33 } }))
    expect(await balanceRow()).toMatchObject({ balance: 520.33, error: null })
  })

  it('ошибка проверки сохраняет прошлый остаток и его время, меняется только текст ошибки', async () => {
    await refreshSmsBalance(pool, config, async () => answer(200, { success: true, data: { balance: 100 } }))
    const before = await balanceRow()
    const log = vi.fn()
    const res = await refreshSmsBalance(pool, config, async () => answer(401, { success: false, message: 'bad key' }), log)
    expect(res.ok).toBe(false)
    const after = await balanceRow()
    expect(after).toMatchObject({ balance: 100, error: expect.stringContaining('bad key') })
    expect(after.checked_at).toEqual(before.checked_at)
    expect(log).toHaveBeenCalledWith('warn', 'sms_balance_failed', { error: expect.stringContaining('bad key') })
  })

  it('первая проверка с ошибкой: строка есть, остатка нет', async () => {
    await refreshSmsBalance(pool, config, async () => answer(502, 'down'))
    expect(await balanceRow()).toMatchObject({ balance: null, error: expect.stringContaining('502') })
  })
})
