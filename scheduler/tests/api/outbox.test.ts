import { readFileSync } from 'node:fs'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { enqueuePush } from '../../src/outbox.js'
import { SCHEDULER_LOCK_KEY } from '../../src/tick.js'
import { createFamily, pool, removeFamilies, resetSent, subscribe, type TestFamily } from '../helpers.js'

// Общий образец payload (contracts/outbox-v1.json): ту же строку читает notifier (notifier/tests/unit/contract.test.ts)
const sample = JSON.parse(readFileSync(new URL('../../../contracts/outbox-v1.json', import.meta.url), 'utf8'))

let fam: TestFamily
beforeAll(async () => {
  fam = await createFamily()
})
afterAll(async () => {
  await resetSent()
  await removeFamilies(fam.id)
  await pool.end()
})

describe('постановка по контракту очереди', () => {
  it('push: строка с приоритетом «плановое», payload как в образце, срок 6 часов', async () => {
    const endpoint = await subscribe(fam.kid.id)
    const { rows: [sub] } = await pool.query('select id from push_subscriptions where endpoint = $1', [endpoint])
    await enqueuePush(pool, sub.id, sample.message)

    const { rows } = await pool.query(`select * from outbox where payload->>'subscriptionId' = $1`, [sub.id])
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ channel: 'push', priority: 2, attempts: 0, last_error: null })
    expect(rows[0].payload).toEqual({ ...sample.push, subscriptionId: sub.id })
    const ttl = (new Date(rows[0].expires_at).getTime() - new Date(rows[0].created_at).getTime()) / 1000
    expect(Math.round(ttl / 3600)).toBe(6)
  })

  it('сообщения с одним tag не склеиваются (дубли исключает журнал)', async () => {
    const endpoint = await subscribe(fam.sis.id)
    const { rows: [sub] } = await pool.query('select id from push_subscriptions where endpoint = $1', [endpoint])
    await enqueuePush(pool, sub.id, sample.message)
    await enqueuePush(pool, sub.id, sample.message)
    const { rowCount } = await pool.query(`select 1 from outbox where payload->>'subscriptionId' = $1`, [sub.id])
    expect(rowCount).toBe(2)
  })
})

describe('общий ключ лидера', () => {
  // пока прежний планировщик живёт в server, ключ обязан совпадать с server/src/notifications/scheduler.ts
  it('совпадает с ключом server: два планировщика не ведут проход одновременно', () => {
    expect(SCHEDULER_LOCK_KEY).toBe(7_301_001)
  })
})
