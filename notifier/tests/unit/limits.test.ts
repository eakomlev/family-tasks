import { describe, expect, it } from 'vitest'
import { createPushGate, hostGroup, TokenBucket } from '../../src/limits.js'

const clockAt = (start = 0) => {
  const state = { t: start }
  return { clock: () => state.t, advance: (ms: number) => void (state.t += ms) }
}

describe('TokenBucket', () => {
  it('всплеск до burst без ожидания, дальше паузы растут по скорости', () => {
    const { clock } = clockAt()
    const bucket = new TokenBucket(2, 2, clock)
    expect(bucket.waitMs()).toBe(0)
    expect(bucket.waitMs()).toBe(0)
    // токенов нет: следующий появится через полсекунды, следующий за ним через секунду
    expect(bucket.waitMs()).toBe(500)
    expect(bucket.waitMs()).toBe(1000)
  })

  it('со временем токены возвращаются, но не больше burst', () => {
    const { clock, advance } = clockAt()
    const bucket = new TokenBucket(2, 2, clock)
    bucket.waitMs()
    bucket.waitMs()
    advance(10_000)
    expect(bucket.waitMs()).toBe(0)
    expect(bucket.waitMs()).toBe(0)
    expect(bucket.waitMs()).toBe(500)
  })

  it('refund возвращает токен: отложенная строка не съедает скорость', () => {
    const { clock } = clockAt()
    const bucket = new TokenBucket(1, 1, clock)
    expect(bucket.waitMs()).toBe(0)
    expect(bucket.waitMs()).toBe(1000)
    bucket.refund()
    expect(bucket.waitMs()).toBe(1000)
  })

  it('pause: все ждут до конца паузы, потом работа продолжается', () => {
    const { clock, advance } = clockAt()
    const bucket = new TokenBucket(100, 100, clock)
    bucket.pause(30_000)
    expect(bucket.waitMs()).toBe(30_000)
    advance(10_000)
    expect(bucket.waitMs()).toBe(20_000)
    advance(20_000)
    expect(bucket.waitMs()).toBe(0)
  })

  it('более короткая пауза не сокращает уже действующую', () => {
    const { clock } = clockAt()
    const bucket = new TokenBucket(100, 100, clock)
    bucket.pause(30_000)
    bucket.pause(1000)
    expect(bucket.waitMs()).toBe(30_000)
  })
})

describe('hostGroup', () => {
  it.each([
    ['https://fcm.googleapis.com/fcm/send/x', 'fcm'],
    ['https://updates.push.services.mozilla.com/wpush/v2/x', 'mozilla'],
    ['https://web.push.apple.com/x', 'apple'],
    ['https://db5p.notify.windows.com/?token=x', 'windows'],
    ['https://push.test/x', 'other'],
    ['not a url', 'other'],
  ])('%s → %s', (endpoint, group) => {
    expect(hostGroup(endpoint)).toBe(group)
  })
})

describe('createPushGate', () => {
  const fcm = 'https://fcm.googleapis.com/fcm/send/a'
  const apple = 'https://web.push.apple.com/b'

  it('у каждой группы свой бакет: исчерпанная очередь FCM не тормозит Apple', () => {
    const { clock } = clockAt()
    const gate = createPushGate(1, clock)
    expect(gate.waitMs(fcm)).toBe(0)
    expect(gate.waitMs(fcm)).toBe(1000)
    expect(gate.waitMs(apple)).toBe(0)
  })

  it('пауза от одного сервиса действует на всю его группу и не задевает других', () => {
    const { clock } = clockAt()
    const gate = createPushGate(100, clock)
    gate.pause('https://fcm.googleapis.com/fcm/send/other-device', 60)
    expect(gate.waitMs(fcm)).toBe(60_000)
    expect(gate.waitMs(apple)).toBe(0)
  })
})
