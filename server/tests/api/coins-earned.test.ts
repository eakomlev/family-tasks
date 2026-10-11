import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { buildApp } from '../../src/app.js'
import { pool } from '../../src/db.js'
import { api, createFamily, removeFamilies, type TestFamily } from '../helpers.js'

let app: Awaited<ReturnType<typeof buildApp>>
let fam: TestFamily

beforeAll(async () => {
  app = await buildApp({ logger: false, rateLimit: false })
  fam = await createFamily()
})
afterAll(async () => {
  await removeFamilies(fam.id)
  await app.close()
  await pool.end()
})

const SINCE = '2026-10-12T00:00:00.000Z'
const earned = async (token: string, since = SINCE) => api(app, token, 'GET', `/api/coins/earned?since=${encodeURIComponent(since)}`)
const add = (memberId: string, amount: number, at: string, taskId: string | null = null) =>
  pool.query('insert into coin_transactions (member_id, amount, reason, created_at, task_id) values ($1, $2, $3, $4, $5)', [memberId, amount, 'x', at, taskId])

describe('GET /api/coins/earned', () => {
  it('нет записей: 0', async () => {
    expect((await earned(fam.kid.token)).body).toEqual({ earned: 0 })
  })

  it('считает только начисления с начала дня; вчерашние и более ранние не входят', async () => {
    await add(fam.kid.id, 100, '2026-10-11T23:59:59Z')
    await add(fam.kid.id, 10, '2026-10-12T00:00:00Z')
    await add(fam.kid.id, 25, '2026-10-12T15:30:00Z')
    expect((await earned(fam.kid.token)).body.earned).toBe(35)
    // с более поздним началом дня предыдущие уже не считаются
    expect((await earned(fam.kid.token, '2026-10-12T12:00:00Z')).body.earned).toBe(25)
  })

  it('траты (списания без задания) заработанное не уменьшают', async () => {
    await add(fam.kid.id, -20, '2026-10-12T16:00:00Z')
    expect((await earned(fam.kid.token)).body.earned).toBe(35)
  })

  it('отмена награды за задание вычитается: награду забрали, значит, она не заработана', async () => {
    const { rows } = await pool.query(
      `insert into tasks (family_id, author_id, assignee_id, title) values ($1, $2, $3, 'Задание') returning id`,
      [fam.id, fam.mom.id, fam.kid.id],
    )
    await add(fam.kid.id, 15, '2026-10-12T17:00:00Z', rows[0].id)
    expect((await earned(fam.kid.token)).body.earned).toBe(50)
    await add(fam.kid.id, -15, '2026-10-12T17:05:00Z', rows[0].id)
    expect((await earned(fam.kid.token)).body.earned).toBe(35)
  })

  it('не бывает отрицательным: отмена вчерашней награды сегодня', async () => {
    const f = await createFamily()
    try {
      const { rows } = await pool.query(`insert into tasks (family_id, author_id, assignee_id, title) values ($1, $2, $3, 'З') returning id`, [f.id, f.mom.id, f.kid.id])
      await add(f.kid.id, -30, '2026-10-12T10:00:00Z', rows[0].id)
      expect((await earned(f.kid.token)).body.earned).toBe(0)
    } finally {
      await removeFamilies(f.id)
    }
  })

  it('у каждого ребёнка свои монеты', async () => {
    await add(fam.sis.id, 7, '2026-10-12T09:00:00Z')
    expect((await earned(fam.sis.token)).body.earned).toBe(7)
  })

  it('родителям и без входа недоступно, since обязателен и должен быть датой', async () => {
    expect((await earned(fam.mom.token)).status).toBe(403)
    expect((await api(app, null, 'GET', `/api/coins/earned?since=${SINCE}`)).status).toBe(401)
    expect((await api(app, fam.kid.token, 'GET', '/api/coins/earned')).status).toBe(400)
    expect((await earned(fam.kid.token, 'вчера')).status).toBe(400)
  })

  it('награда за задание попадает в «заработано» сразу после выполнения', async () => {
    const f = await createFamily()
    try {
      const task = (await api(app, f.mom.token, 'POST', '/api/tasks', { title: 'Убрать', assigneeId: f.kid.id, reward: 12, date: '2026-10-12', time: null, repeat: { type: 'none' } })).body.task
      await api(app, f.kid.token, 'POST', `/api/tasks/${task.id}/complete`, { date: '2026-10-12' })
      const since = new Date(Date.now() - 60_000).toISOString()
      expect((await earned(f.kid.token, since)).body.earned).toBe(12)
      await api(app, f.kid.token, 'POST', `/api/tasks/${task.id}/uncomplete`, { date: '2026-10-12' })
      expect((await earned(f.kid.token, since)).body.earned).toBe(0)
    } finally {
      await removeFamilies(f.id)
    }
  })
})
