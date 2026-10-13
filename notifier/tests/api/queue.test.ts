import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { beat, claim, isAlive } from '../../src/queue.js'
import { clearOutbox, insertRow, pool, rowById } from '../helpers.js'

const NOW = new Date('2026-10-13T10:00:00Z')
const at = (seconds: number) => new Date(NOW.getTime() + seconds * 1000)

beforeEach(clearOutbox)
afterAll(async () => {
  await clearOutbox()
  await pool.query(`delete from notifier_heartbeat where instance like 'test-%'`)
  await pool.end()
})

describe('аренда строк', () => {
  it('забранную строку второй проход не получает, пока аренда не истекла', async () => {
    const id = await insertRow()
    expect(await claim(pool, NOW, 10, 60)).toHaveLength(1)
    expect((await rowById(id)).attempts).toBe(1)

    expect(await claim(pool, at(30), 10, 60)).toHaveLength(0)
    // аренда закончилась (notifier не ответил): строка снова доступна, и это уже вторая попытка
    const again = await claim(pool, at(61), 10, 60)
    expect(again).toHaveLength(1)
    expect(again[0].attempts).toBe(2)
  })

  it('строки, занятые другим забором, пропускаются, а не ожидаются (skip locked)', async () => {
    const [first, second, third] = [await insertRow(), await insertRow(), await insertRow()]
    // другой notifier посреди забора: держит блокировку первых двух строк
    const other = await pool.connect()
    try {
      await other.query('begin')
      await other.query('select id from outbox where id = any($1) for update', [[first, second]])

      // без skip locked этот запрос завис бы до конца чужой транзакции
      const claimed = await Promise.race([
        claim(pool, NOW, 10, 60),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('забор ждёт чужую блокировку')), 2000)),
      ])
      expect(claimed.map((r) => r.id)).toEqual([third])
    } finally {
      await other.query('rollback')
      other.release()
    }
  })

  it('два забора подряд не выдают одну строку дважды', async () => {
    for (let i = 0; i < 10; i++) await insertRow()
    const ids = [...(await claim(pool, NOW, 6, 60)), ...(await claim(pool, NOW, 6, 60))].map((r) => r.id)
    expect(ids).toHaveLength(10)
    expect(new Set(ids).size).toBe(10)
  })

  it('строка с исчерпанными попытками не выдаётся', async () => {
    await insertRow({ attempts: 3 })
    expect(await claim(pool, NOW, 10, 60)).toHaveLength(0)
  })
})

describe('метка живости', () => {
  it('свежая метка: жив, старая или отсутствует: нет', async () => {
    expect(await isAlive(pool, 'test-a', NOW, 60)).toBe(false)
    await beat(pool, 'test-a', NOW)
    expect(await isAlive(pool, 'test-a', at(30), 60)).toBe(true)
    expect(await isAlive(pool, 'test-a', at(90), 60)).toBe(false)
  })

  it('метки экземпляров независимы', async () => {
    await beat(pool, 'test-b', NOW)
    expect(await isAlive(pool, 'test-b', NOW, 60)).toBe(true)
    expect(await isAlive(pool, 'test-c', NOW, 60)).toBe(false)
  })

  it('следы экземпляров, молчащих больше суток, удаляются', async () => {
    await beat(pool, 'test-old', NOW)
    await beat(pool, 'test-new', at(25 * 3600))
    const { rows } = await pool.query(`select instance from notifier_heartbeat where instance in ('test-old', 'test-new')`)
    expect(rows.map((r) => r.instance)).toEqual(['test-new'])
  })
})
