import { describe, expect, it } from 'vitest'
import { backoffSeconds, MAX_ATTEMPTS, parseRetryAfter } from '../../src/retry.js'

describe('backoffSeconds', () => {
  it('всего три попытки', () => {
    expect(MAX_ATTEMPTS).toBe(3)
  })

  it('письмо: первая пауза около 5 секунд, вторая около 30 (код живёт 10 минут)', () => {
    expect(backoffSeconds('email', 1, undefined, () => 0.5)).toBe(5)
    expect(backoffSeconds('email', 2, undefined, () => 0.5)).toBe(30)
  })

  it('push: около минуты, затем около десяти', () => {
    expect(backoffSeconds('push', 1, undefined, () => 0.5)).toBe(60)
    expect(backoffSeconds('push', 2, undefined, () => 0.5)).toBe(600)
  })

  it('разброс плюс-минус 20%', () => {
    expect(backoffSeconds('push', 1, undefined, () => 0)).toBeCloseTo(48)
    expect(backoffSeconds('push', 1, undefined, () => 1)).toBeCloseTo(72)
  })

  it('номер вне таблицы берёт ближайшую паузу', () => {
    expect(backoffSeconds('email', 0, undefined, () => 0.5)).toBe(5)
    expect(backoffSeconds('email', 9, undefined, () => 0.5)).toBe(30)
  })

  it('Retry-After провайдера удлиняет паузу, но не дольше часа', () => {
    expect(backoffSeconds('email', 1, 120, () => 0.5)).toBe(120)
    expect(backoffSeconds('email', 2, 5, () => 0.5)).toBe(30)
    expect(backoffSeconds('push', 1, 999_999, () => 0.5)).toBe(3600)
  })
})

describe('parseRetryAfter', () => {
  const now = new Date('2026-10-13T10:00:00Z')

  it('секунды', () => {
    expect(parseRetryAfter('120', now)).toBe(120)
    expect(parseRetryAfter(30, now)).toBe(30)
  })

  it('дата', () => {
    expect(parseRetryAfter('Tue, 13 Oct 2026 10:01:00 GMT', now)).toBe(60)
    expect(parseRetryAfter('Tue, 13 Oct 2026 09:00:00 GMT', now)).toBe(0)
  })

  it('мусор и пустое значение', () => {
    expect(parseRetryAfter(undefined, now)).toBeUndefined()
    expect(parseRetryAfter(null, now)).toBeUndefined()
    expect(parseRetryAfter('скоро', now)).toBeUndefined()
  })
})
