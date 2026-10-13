import { randomBytes } from 'node:crypto'
import { afterAll, describe, expect, it } from 'vitest'
import { createDailyBudget } from '../../src/limits.js'
import { pool } from '../helpers.js'

// своё имя провайдера в каждом тесте: строки не пересекаются
const name = () => `test-${randomBytes(4).toString('hex')}`
const names: string[] = []
const provider = () => {
  const n = name()
  names.push(n)
  return n
}

afterAll(async () => {
  await pool.query('delete from provider_usage where provider = any($1)', [names])
  await pool.end()
})

const countOf = async (p: string) =>
  (await pool.query('select day::text, count from provider_usage where provider = $1 order by day', [p])).rows

describe('дневной бюджет в БД', () => {
  it('занимает по единице до лимита, затем отказывает и не растёт', async () => {
    const p = provider()
    const budget = createDailyBudget(pool, p, 3, () => Date.parse('2026-10-13T10:00:00Z'))

    expect((await budget.reserve()).used).toBe(1)
    expect((await budget.reserve()).used).toBe(2)
    expect(await budget.reserve()).toMatchObject({ ok: true, used: 3, day: '2026-10-13' })
    expect(await budget.reserve()).toMatchObject({ ok: false, used: 3 })
    expect(await budget.reserve()).toMatchObject({ ok: false, used: 3 })
    expect(await countOf(p)).toEqual([{ day: '2026-10-13', count: 3 }])
  })

  it('параллельные занятия не превышают лимит (атомарность)', async () => {
    const p = provider()
    const budget = createDailyBudget(pool, p, 10, () => Date.parse('2026-10-13T10:00:00Z'))
    const results = await Promise.all(Array.from({ length: 40 }, () => budget.reserve()))
    expect(results.filter((r) => r.ok)).toHaveLength(10)
    expect(await countOf(p)).toEqual([{ day: '2026-10-13', count: 10 }])
  })

  it('два экземпляра с общим счётчиком вместе не превышают лимит', async () => {
    const p = provider()
    const clock = () => Date.parse('2026-10-13T10:00:00Z')
    const a = createDailyBudget(pool, p, 10, clock)
    const b = createDailyBudget(pool, p, 10, clock)
    const results = await Promise.all(Array.from({ length: 30 }, (_, i) => (i % 2 ? a : b).reserve()))
    expect(results.filter((r) => r.ok)).toHaveLength(10)
  })

  it('сутки по UTC: в полночь счётчик начинается заново', async () => {
    const p = provider()
    let now = Date.parse('2026-10-13T23:59:59Z')
    const budget = createDailyBudget(pool, p, 1, () => now)

    expect(await budget.reserve()).toMatchObject({ ok: true, day: '2026-10-13' })
    expect((await budget.reserve()).ok).toBe(false)
    now = Date.parse('2026-10-14T00:00:00Z')
    expect(await budget.reserve()).toMatchObject({ ok: true, day: '2026-10-14', used: 1 })
    expect(await countOf(p)).toEqual([
      { day: '2026-10-13', count: 1 },
      { day: '2026-10-14', count: 1 },
    ])
  })

  it('release возвращает единицу за те же сутки, ниже нуля не уходит', async () => {
    const p = provider()
    let now = Date.parse('2026-10-13T23:59:59Z')
    const budget = createDailyBudget(pool, p, 5, () => now)
    const slot = await budget.reserve()
    now = Date.parse('2026-10-14T00:00:05Z')
    await budget.release(slot.day)
    await budget.release(slot.day)
    expect(await countOf(p)).toEqual([{ day: '2026-10-13', count: 0 }])
  })

  it('лимит 0: без ограничения и без записей в БД', async () => {
    const p = provider()
    const budget = createDailyBudget(pool, p, 0)
    for (let i = 0; i < 5; i++) expect((await budget.reserve()).ok).toBe(true)
    await budget.release((await budget.reserve()).day)
    expect(await countOf(p)).toEqual([])
  })
})
