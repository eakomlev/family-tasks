import { describe, expect, it, vi } from 'vitest'
import { limitMail, MAX_SLEEP_MS, TokenBucket, type DailyBudget } from '../../src/limits.js'
import type { Outcome } from '../../src/outcome.js'

const payload = { v: 1, kind: 'code', to: 'a@test.local', code: '123456', ttlMinutes: 10 } as const

// Бюджет в памяти: тот же интерфейс, что у БД-версии (её проверяет tests/api/budget.test.ts).
function memoryBudget(limit: number, day = '2026-10-13') {
  let used = 0
  const budget: DailyBudget = {
    async reserve() {
      if (used >= limit) return { ok: false, used, day }
      used++
      return { ok: true, used, day }
    },
    async release() {
      used = Math.max(0, used - 1)
    },
  }
  return { budget, used: () => used }
}

function setup(options: { limit?: number; rate?: number; send?: () => Promise<Outcome> } = {}) {
  const { limit = 10, rate = 1000, send = async (): Promise<Outcome> => ({ kind: 'sent' }) } = options
  const inner = vi.fn(async () => send())
  const log = vi.fn()
  const sleep = vi.fn(async () => {})
  const memory = memoryBudget(limit)
  const clock = { t: 0 }
  const limited = limitMail(inner, { gate: new TokenBucket(rate, Math.max(1, rate), () => clock.t), budget: memory.budget, limit, log, sleep })
  return { limited, inner, log, sleep, memory, clock }
}

describe('дневной бюджет', () => {
  it('пока есть бюджет, письма уходят и расходуют его', async () => {
    const { limited, memory } = setup({ limit: 5 })
    expect(await limited(payload)).toEqual({ kind: 'sent' })
    expect(memory.used()).toBe(1)
  })

  it('бюджет исчерпан: письмо не отправляется, откладывается без траты попытки, в журнал раз', async () => {
    const { limited, inner, log } = setup({ limit: 2 })
    await limited(payload)
    await limited(payload)

    const third = await limited(payload)
    const fourth = await limited(payload)

    expect(third).toEqual({ kind: 'defer', seconds: 60, reason: 'daily_budget' })
    expect(fourth.kind).toBe('defer')
    expect(inner).toHaveBeenCalledTimes(2)
    const exhausted = log.mock.calls.filter(([, event]) => event === 'mail_budget_exhausted')
    expect(exhausted).toEqual([['error', 'mail_budget_exhausted', { day: '2026-10-13', used: 2, limit: 2 }]])
  })

  it('предупреждение при 80% один раз за сутки', async () => {
    const { limited, log } = setup({ limit: 10 })
    for (let i = 0; i < 9; i++) await limited(payload)
    const warnings = log.mock.calls.filter(([, event]) => event === 'mail_budget_80')
    expect(warnings).toEqual([['warn', 'mail_budget_80', { day: '2026-10-13', used: 8, limit: 10 }]])
  })

  it('не принятое провайдером письмо возвращает единицу бюджета', async () => {
    const { limited, memory } = setup({ send: async () => ({ kind: 'retry', error: 'ETIMEDOUT' }) })
    expect((await limited(payload)).kind).toBe('retry')
    expect(memory.used()).toBe(0)
  })
})

describe('скорость', () => {
  it('короткую паузу ждёт, а не откладывает', async () => {
    const { limited, sleep } = setup({ rate: 1 })
    await limited(payload)
    const second = await limited(payload)
    expect(second).toEqual({ kind: 'sent' })
    expect(sleep).toHaveBeenCalledWith(1000)
  })

  it('долгую паузу не ждёт: строка откладывается, токен и бюджет не тратятся', async () => {
    const { limited, inner, memory } = setup({ rate: 0.1 })
    await limited(payload)
    const before = memory.used()
    const second = await limited(payload)

    expect(second).toEqual({ kind: 'defer', seconds: 10, reason: 'rate_limited' })
    expect(MAX_SLEEP_MS).toBeLessThan(10_000)
    expect(inner).toHaveBeenCalledTimes(1)
    expect(memory.used()).toBe(before)
  })
})
