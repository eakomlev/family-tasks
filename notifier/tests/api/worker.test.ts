import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { EmailPayload, PushPayload } from '../../src/contract.js'
import type { Outcome } from '../../src/outcome.js'
import { processBatch, type Providers } from '../../src/worker.js'
import { clearOutbox, emailPayload, insertRow, pool, rowById } from '../helpers.js'

const NOW = new Date('2026-10-13T10:00:00Z')
const at = (seconds: number) => new Date(NOW.getTime() + seconds * 1000)
const noLog = vi.fn()

function providers(email: () => Promise<Outcome> | Outcome = () => ({ kind: 'sent' }), push: () => Promise<Outcome> | Outcome = () => ({ kind: 'sent' })) {
  return {
    email: vi.fn(async (_payload: EmailPayload) => email()),
    push: vi.fn(async (_payload: PushPayload) => push()),
  } satisfies Providers
}
const run = (p: Providers, extra = {}) => processBatch(pool, p, { now: NOW, log: noLog, ...extra })

beforeEach(async () => {
  noLog.mockClear()
  await clearOutbox()
})
afterAll(async () => {
  await clearOutbox()
  await pool.end()
})

describe('успех', () => {
  it('отправленная строка удаляется', async () => {
    const id = await insertRow()
    const p = providers()
    const stats = await run(p)

    expect(stats).toMatchObject({ claimed: 1, sent: 1, retried: 0, failed: 0 })
    expect(p.email).toHaveBeenCalledWith(emailPayload())
    expect(await rowById(id)).toBeUndefined()
  })

  it('письмо идёт в почту, push в push', async () => {
    await insertRow({ channel: 'email' })
    await insertRow({
      channel: 'push',
      payload: { v: 1, subscriptionId: 's1', message: { title: 't', body: 'b', url: '/', tag: 'x' } },
    })
    const p = providers()
    await run(p)
    expect(p.email).toHaveBeenCalledTimes(1)
    expect(p.push).toHaveBeenCalledTimes(1)
  })

  it('пустая очередь: ничего не делает', async () => {
    expect(await run(providers())).toMatchObject({ claimed: 0, sent: 0 })
  })

  it('сначала более важные: коды входа раньше плановых, внутри приоритета по порядку', async () => {
    await insertRow({ priority: 2, payload: emailPayload('planned@test.local') })
    await insertRow({ priority: 0, payload: emailPayload('code1@test.local') })
    await insertRow({ priority: 1, payload: emailPayload('event@test.local') })
    await insertRow({ priority: 0, payload: emailPayload('code2@test.local') })
    const p = providers()
    await run(p, { concurrency: 1 })
    expect(p.email.mock.calls.map(([payload]) => payload.to)).toEqual([
      'code1@test.local', 'code2@test.local', 'event@test.local', 'planned@test.local',
    ])
  })

  it('берёт не больше limit за проход', async () => {
    for (let i = 0; i < 5; i++) await insertRow()
    const stats = await run(providers(), { limit: 3 })
    expect(stats.claimed).toBe(3)
    expect((await pool.query('select count(*)::int as n from outbox')).rows[0].n).toBe(2)
  })

  it('не отправляет строки, которым ещё рано', async () => {
    const id = await insertRow({ nextAttemptAt: at(30) })
    const p = providers()
    expect((await run(p)).claimed).toBe(0)
    expect(await rowById(id)).toBeDefined()
    expect((await run(p, { now: at(31) })).claimed).toBe(1)
  })
})

describe('повторы', () => {
  const failing = (): Outcome => ({ kind: 'retry', error: 'ETIMEDOUT' })

  it('временная ошибка: строка остаётся, попытка записана, пауза около 5 секунд для письма', async () => {
    const id = await insertRow()
    const stats = await run(providers(failing))

    expect(stats).toMatchObject({ claimed: 1, retried: 1, sent: 0, failed: 0 })
    const row = await rowById(id)
    expect(row).toMatchObject({ attempts: 1, last_error: 'ETIMEDOUT' })
    const delay = (new Date(row.next_attempt_at).getTime() - NOW.getTime()) / 1000
    expect(delay).toBeGreaterThanOrEqual(4)
    expect(delay).toBeLessThanOrEqual(6)
  })

  it('уважает Retry-After провайдера', async () => {
    const id = await insertRow()
    await run(providers(() => ({ kind: 'retry', error: '429', retryAfterSeconds: 120 })))
    const row = await rowById(id)
    expect((new Date(row.next_attempt_at).getTime() - NOW.getTime()) / 1000).toBe(120)
  })

  it('три попытки: после третьей неудачи строка удаляется, причина уходит в журнал', async () => {
    const id = await insertRow()
    const p = providers(failing)

    await run(p, { now: at(0) })
    expect((await rowById(id)).attempts).toBe(1)
    await run(p, { now: at(100) })
    expect((await rowById(id)).attempts).toBe(2)
    expect(noLog).not.toHaveBeenCalled()

    const stats = await run(p, { now: at(1000) })
    expect(stats).toMatchObject({ claimed: 1, failed: 1, retried: 0 })
    expect(await rowById(id)).toBeUndefined()
    expect(p.email).toHaveBeenCalledTimes(3)
    expect(noLog).toHaveBeenCalledWith('error', 'outbox_failed', { id, channel: 'email', attempts: 3, error: 'ETIMEDOUT' })
  })

  it('успех со второй попытки удаляет строку', async () => {
    const id = await insertRow()
    let calls = 0
    const p = providers(() => (++calls === 1 ? failing() : { kind: 'sent' }))
    await run(p, { now: at(0) })
    await run(p, { now: at(100) })
    expect(await rowById(id)).toBeUndefined()
    expect(noLog).not.toHaveBeenCalled()
  })

  it('исключение провайдера считается временной ошибкой, а не роняет проход', async () => {
    const id = await insertRow()
    const stats = await run(providers(() => { throw new Error('unexpected') }))
    expect(stats.retried).toBe(1)
    expect((await rowById(id)).last_error).toBe('unexpected')
  })
})

describe('окончательные исходы', () => {
  it('постоянная ошибка: сразу удаляется без повторов, в журнал', async () => {
    const id = await insertRow()
    const stats = await run(providers(() => ({ kind: 'fail', error: '550 no such user' })))
    expect(stats).toMatchObject({ failed: 1, retried: 0 })
    expect(await rowById(id)).toBeUndefined()
    expect(noLog).toHaveBeenCalledWith('error', 'outbox_failed', expect.objectContaining({ id, error: '550 no such user' }))
  })

  it('отправлять некому (skip): удаляется тихо', async () => {
    const id = await insertRow()
    const stats = await run(providers(() => ({ kind: 'skip', reason: 'subscription_gone' })))
    expect(stats).toMatchObject({ skipped: 1, failed: 0 })
    expect(await rowById(id)).toBeUndefined()
    expect(noLog).not.toHaveBeenCalled()
  })

  it('битый payload: удаляется, провайдер не вызывается', async () => {
    const id = await insertRow({ payload: { v: 1, kind: 'code' } })
    const p = providers()
    const stats = await run(p)
    expect(stats.failed).toBe(1)
    expect(p.email).not.toHaveBeenCalled()
    expect(await rowById(id)).toBeUndefined()
  })

  it('версия payload новее: строка остаётся для обновлённого notifier и попытка не тратится', async () => {
    const id = await insertRow({ payload: { ...emailPayload(), v: 2 } })
    const p = providers()
    const stats = await run(p)

    expect(stats).toMatchObject({ deferred: 1, failed: 0 })
    expect(p.email).not.toHaveBeenCalled()
    const row = await rowById(id)
    expect(row.attempts).toBe(0)
    expect((new Date(row.next_attempt_at).getTime() - NOW.getTime()) / 1000).toBe(60)
    // обновлённый notifier позже подхватит
    expect((await run(providers(), { now: at(61) })).claimed).toBe(1)
  })
})

describe('лимиты', () => {
  it('defer: строка возвращается без траты попытки и предлагается снова позже', async () => {
    const id = await insertRow()
    const stats = await run(providers(() => ({ kind: 'defer', seconds: 90, reason: 'daily_budget' })))

    expect(stats).toMatchObject({ claimed: 1, deferred: 1, sent: 0, failed: 0, retried: 0 })
    const row = await rowById(id)
    expect(row.attempts).toBe(0)
    expect((new Date(row.next_attempt_at).getTime() - NOW.getTime()) / 1000).toBe(90)
    expect(noLog).not.toHaveBeenCalled()
    // до срока строку не трогают, после срока забирают снова
    expect((await run(providers(), { now: at(60) })).claimed).toBe(0)
    expect((await run(providers(), { now: at(91) })).sent).toBe(1)
  })

  it('сколько бы раз ни откладывали, попытки не кончаются (только срок жизни)', async () => {
    const id = await insertRow()
    const p = providers(() => ({ kind: 'defer', seconds: 10, reason: 'rate_limited' }))
    for (let i = 0; i < 6; i++) await run(p, { now: at(i * 20) })
    expect((await rowById(id)).attempts).toBe(0)
  })
})

describe('срок жизни', () => {
  it('просроченное не отправляется и убирается с записью в журнал', async () => {
    const id = await insertRow({ expiresAt: at(-1) })
    const p = providers()
    const stats = await run(p)

    expect(p.email).not.toHaveBeenCalled()
    expect(stats).toMatchObject({ reaped: 1, claimed: 0 })
    expect(await rowById(id)).toBeUndefined()
    expect(noLog).toHaveBeenCalledWith('error', 'outbox_expired', expect.objectContaining({ id, reason: 'expired' }))
  })

  it('попытки кончились, а notifier упал на последней: после окончания аренды строка убирается', async () => {
    const id = await insertRow({ attempts: 3, nextAttemptAt: at(-1) })
    const p = providers()
    const stats = await run(p)
    expect(p.email).not.toHaveBeenCalled()
    expect(stats.reaped).toBe(1)
    expect(await rowById(id)).toBeUndefined()
    expect(noLog).toHaveBeenCalledWith('error', 'outbox_failed', expect.objectContaining({ id, reason: 'exhausted' }))
  })

  it('попытка ещё идёт (аренда не истекла): строку не трогают', async () => {
    const id = await insertRow({ attempts: 3, nextAttemptAt: at(30) })
    const stats = await run(providers())
    expect(stats.reaped).toBe(0)
    expect(await rowById(id)).toBeDefined()
  })
})
