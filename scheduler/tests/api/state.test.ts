import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { beat, isAlive, recordTick } from '../../src/state.js'
import { pool } from '../helpers.js'

const NAME = 'test-instance'
const at = (iso: string) => new Date(`2026-10-06T${iso}Z`)

beforeEach(async () => {
  await pool.query('delete from scheduler_state where instance = $1', [NAME])
})
afterAll(async () => {
  await pool.query('delete from scheduler_state where instance = $1', [NAME])
  await pool.end()
})

describe('состояние планировщика', () => {
  it('метка свежая: жив; старше предела: нет; чужого экземпляра нет', async () => {
    await beat(pool, NAME, at('10:00:00'))
    expect(await isAlive(pool, NAME, at('10:00:30'), 60)).toBe(true)
    expect(await isAlive(pool, NAME, at('10:02:00'), 60)).toBe(false)
    expect(await isAlive(pool, 'other', at('10:00:30'), 60)).toBe(false)
  })

  it('итог прохода сохраняется и не сбрасывается меткой', async () => {
    await recordTick(pool, NAME, at('10:00:00'), 3, null)
    await beat(pool, NAME, at('10:00:15'))
    const { rows } = await pool.query('select last_tick_at, last_sent, last_error from scheduler_state where instance = $1', [NAME])
    expect(rows[0]).toMatchObject({ last_sent: 3, last_error: null })
    expect(rows[0].last_tick_at).toEqual(at('10:00:00'))

    await recordTick(pool, NAME, at('10:01:00'), 0, 'очередь недоступна')
    const { rows: [after] } = await pool.query('select last_sent, last_error from scheduler_state where instance = $1', [NAME])
    expect(after).toEqual({ last_sent: 0, last_error: 'очередь недоступна' })
  })
})
