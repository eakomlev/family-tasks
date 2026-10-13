import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPushGate } from '../../src/limits.js'
import { createPushProvider, type SendNotification } from '../../src/providers/webpush.js'
import { createMember, pool, removeFamily, subscribe } from '../helpers.js'

const message = { title: 'Заголовок', body: 'Текст', url: '/tasks', tag: 'test' }
let familyId: string
let memberId: string

beforeAll(async () => {
  ;({ familyId, memberId } = await createMember())
})
afterAll(async () => {
  await removeFamily(familyId)
  await pool.end()
})

const payload = (subscriptionId: string) => ({ v: 1 as const, subscriptionId, message })
const provider = (send: SendNotification, enabled = true) => createPushProvider(pool, send, enabled)
const exists = async (id: string) => (await pool.query('select 1 from push_subscriptions where id = $1', [id])).rowCount === 1
const failWith = (statusCode: number | undefined, headers: Record<string, string> = {}) =>
  vi.fn(async () => { throw Object.assign(new Error('provider said no'), { statusCode, headers }) })

let sub: { id: string; endpoint: string }
beforeEach(async () => {
  sub = await subscribe(memberId)
})

describe('отправка', () => {
  it('шлёт сообщение на устройство с TTL 6 часов', async () => {
    const send = vi.fn(async () => ({}))
    expect(await provider(send)(payload(sub.id))).toEqual({ kind: 'sent' })
    expect(send).toHaveBeenCalledWith(
      { endpoint: sub.endpoint, keys: { p256dh: 'p', auth: 'a' } },
      JSON.stringify(message),
      { TTL: 6 * 3600 },
    )
  })

  it('push не настроен (нет ключей VAPID): постоянная ошибка, никуда не ходит', async () => {
    const send = vi.fn()
    expect(await provider(send, false)(payload(sub.id))).toEqual({ kind: 'fail', error: 'push_not_configured' })
    expect(send).not.toHaveBeenCalled()
  })

  it('подписки нет: пропуск без отправки', async () => {
    const send = vi.fn()
    expect(await provider(send)(payload('00000000-0000-4000-8000-000000000000'))).toEqual({ kind: 'skip', reason: 'subscription_gone' })
    expect(send).not.toHaveBeenCalled()
  })

  it('адрес не из списка разрешённых: запрос не делается (защита от SSRF)', async () => {
    const evil = await subscribe(memberId, 'https://evil.example.com/push')
    const send = vi.fn()
    expect(await provider(send)(payload(evil.id))).toEqual({ kind: 'fail', error: 'endpoint_not_allowed' })
    expect(send).not.toHaveBeenCalled()
  })
})

describe('ошибки провайдера', () => {
  it.each([404, 410])('%i: подписка удаляется, строка очереди уходит тихо', async (status) => {
    expect(await provider(failWith(status))(payload(sub.id))).toEqual({ kind: 'skip', reason: 'subscription_gone' })
    expect(await exists(sub.id)).toBe(false)
  })

  it.each([400, 401, 403, 413])('%i: постоянная, подписка остаётся', async (status) => {
    const result = await provider(failWith(status))(payload(sub.id))
    expect(result.kind).toBe('fail')
    expect(await exists(sub.id)).toBe(true)
  })

  it('429 с Retry-After: повтор позже', async () => {
    const result = await provider(failWith(429, { 'retry-after': '90' }))(payload(sub.id))
    expect(result).toMatchObject({ kind: 'retry', retryAfterSeconds: 90 })
    expect(await exists(sub.id)).toBe(true)
  })

  it.each([500, 502, 503, undefined])('%s: временная ошибка', async (status) => {
    const result = await provider(failWith(status))(payload(sub.id))
    expect(result.kind).toBe('retry')
    expect(await exists(sub.id)).toBe(true)
  })
})

describe('ограничение скорости', () => {
  const clock = { t: 0 }
  const provider = (send: SendNotification, rate: number, sleep = vi.fn(async () => {}), log = vi.fn()) => ({
    run: createPushProvider(pool, send, true, { gate: createPushGate(rate, () => clock.t), sleep, log }),
    sleep,
    log,
  })

  it('короткую паузу ждёт, затем отправляет', async () => {
    clock.t = 0
    const send = vi.fn(async () => ({}))
    const { run, sleep } = provider(send, 1)
    expect(await run(payload(sub.id))).toEqual({ kind: 'sent' })
    expect(await run(payload(sub.id))).toEqual({ kind: 'sent' })
    expect(sleep).toHaveBeenCalledWith(1000)
  })

  it('долгую паузу не ждёт: строка откладывается, запрос не делается', async () => {
    clock.t = 0
    const send = vi.fn(async () => ({}))
    const { run } = provider(send, 0.1)
    await run(payload(sub.id))
    expect(await run(payload(sub.id))).toEqual({ kind: 'defer', seconds: 10, reason: 'rate_limited' })
    expect(send).toHaveBeenCalledTimes(1)
  })

  it('429 с Retry-After притормаживает всю группу сервиса, другие группы не задеты', async () => {
    clock.t = 0
    const { run, log } = provider(failWith(429, { 'retry-after': '120' }), 100)
    const other = await subscribe(memberId, 'https://push.test/other-device')
    // первое устройство получает 429 и просит подождать 2 минуты
    expect(await run(payload(sub.id))).toMatchObject({ kind: 'retry', retryAfterSeconds: 120 })
    expect(log).toHaveBeenCalledWith('warn', 'provider_throttled', { provider: 'push', group: 'other', seconds: 120 })
    // другое устройство той же группы откладывается, не дожидаясь ответа сервиса
    expect(await run(payload(other.id))).toEqual({ kind: 'defer', seconds: 120, reason: 'rate_limited' })
    // после паузы работа возобновляется
    clock.t = 121_000
    expect((await run(payload(other.id))).kind).toBe('retry')
  })

  it('429 без Retry-After не включает паузу для группы', async () => {
    clock.t = 0
    const { run } = provider(failWith(429), 100)
    expect((await run(payload(sub.id))).kind).toBe('retry')
    expect((await run(payload(sub.id))).kind).toBe('retry')
  })
})
