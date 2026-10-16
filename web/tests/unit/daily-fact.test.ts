import { beforeEach, describe, expect, it } from 'vitest'
import { closeFact, dayOfYear, factOfDay, factsForAge, isFactClosed, shouldShowFact } from '@/lib/dailyFact'
import facts79 from '@/facts/facts-7-9.json'
import facts1013 from '@/facts/facts-10-13.json'

describe('факт дня', () => {
  beforeEach(() => localStorage.clear())

  it('номер дня в году, включая високосный', () => {
    expect(dayOfYear(new Date(2026, 0, 1))).toBe(1)
    expect(dayOfYear(new Date(2026, 11, 31))).toBe(365)
    expect(dayOfYear(new Date(2028, 11, 31))).toBe(366)
  })

  it('за год факты не повторяются', () => {
    const seen = new Set<number>()
    for (let d = 0; d < 366; d++) seen.add(factOfDay(facts79, new Date(2028, 0, 1 + d)).id)
    expect(seen.size).toBe(366)
  })

  it('набор по возрасту', () => {
    const now = new Date(2026, 9, 16, 10)
    expect(factsForAge('2018-01-01', now)).toBe(facts79) // 8 лет
    expect(factsForAge('2016-01-01', now)).toBe(facts1013) // 10 лет
    expect(factsForAge(null, now)).toBe(facts79)
  })

  it('показ с 9:00', () => {
    expect(shouldShowFact(new Date(2026, 9, 16, 8, 59))).toBe(false)
    expect(shouldShowFact(new Date(2026, 9, 16, 9, 0))).toBe(true)
  })

  it('закрытие действует только в тот же день и для того же участника', () => {
    const now = new Date(2026, 9, 16, 10)
    expect(isFactClosed('m1', now)).toBe(false)
    closeFact('m1', now)
    expect(isFactClosed('m1', now)).toBe(true)
    expect(isFactClosed('m2', now)).toBe(false)
    expect(isFactClosed('m1', new Date(2026, 9, 17, 10))).toBe(false)
  })
})
