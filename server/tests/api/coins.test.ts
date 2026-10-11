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

const history = (token: string, query = '') => api(app, token, 'GET', `/api/coins${query}`)

// n записей с растущим временем: запись i создана i минут назад, id нужен для before
async function addEntries(memberId: string, n: number, by: string | null = null) {
  for (let i = n; i >= 1; i--) {
    await pool.query(
      `insert into coin_transactions (member_id, amount, reason, created_by, created_at) values ($1, $2, $3, $4, now() - make_interval(mins => $5))`,
      [memberId, i, `запись ${i}`, by, i],
    )
  }
}

describe('GET /api/coins', () => {
  it('пустая история: баланс 0, записей нет', async () => {
    const { status, body } = await history(fam.kid.token)
    expect(status).toBe(200)
    expect(body).toEqual({ balance: 0, items: [], hasMore: false })
  })

  it('сколько, когда, кем и за что; свежее сверху; баланс как в /api/me', async () => {
    await pool.query(`insert into coin_transactions (member_id, amount, reason, created_by, created_at) values
      ($1, 50, 'за уборку', $2, now() - interval '2 hours'),
      ($1, -20, 'мороженое', $3, now() - interval '1 hour'),
      ($1, 5, '', null, now())`, [fam.kid.id, fam.mom.id, fam.dad.id])
    const { body } = await history(fam.kid.token)
    expect(body.balance).toBe(35)
    expect(body.items.map((i: { amount: number }) => i.amount)).toEqual([5, -20, 50])
    expect(body.items[0]).toMatchObject({ amount: 5, reason: '', createdBy: null })
    expect(body.items[1]).toMatchObject({ amount: -20, reason: 'мороженое', createdBy: fam.dad.id })
    expect(body.items[2]).toMatchObject({ amount: 50, reason: 'за уборку', createdBy: fam.mom.id })
    expect(typeof body.items[2].createdAt).toBe('string')
    expect(new Date(body.items[2].createdAt).getTime()).toBeLessThan(new Date(body.items[1].createdAt).getTime())
    expect((await api(app, fam.kid.token, 'GET', '/api/me')).body.member.coins).toBe(35)
  })

  it('чужие записи не видны: у сестры своя история', async () => {
    const { body } = await history(fam.sis.token)
    expect(body.items).toEqual([])
    expect(body.balance).toBe(0)
  })

  it('родителям и без входа недоступно', async () => {
    expect((await history(fam.mom.token)).status).toBe(403)
    expect((await history(fam.mom.token)).body.error).toBe('not_a_child')
    expect((await api(app, null, 'GET', '/api/coins')).status).toBe(401)
  })
})

describe('постраничная загрузка', () => {
  it('страницами по limit, без дублей и пропусков, до конца', async () => {
    const f = await createFamily()
    try {
      await addEntries(f.kid.id, 7)
      const page1 = (await history(f.kid.token, '?limit=3')).body
      expect(page1.items.map((i: { reason: string }) => i.reason)).toEqual(['запись 1', 'запись 2', 'запись 3'])
      expect(page1.hasMore).toBe(true)

      const page2 = (await history(f.kid.token, `?limit=3&before=${page1.items[2].id}`)).body
      expect(page2.items.map((i: { reason: string }) => i.reason)).toEqual(['запись 4', 'запись 5', 'запись 6'])
      expect(page2.hasMore).toBe(true)

      const page3 = (await history(f.kid.token, `?limit=3&before=${page2.items[2].id}`)).body
      expect(page3.items.map((i: { reason: string }) => i.reason)).toEqual(['запись 7'])
      expect(page3.hasMore).toBe(false)
      // баланс приходит с каждой страницей и не зависит от страницы
      expect([page1.balance, page2.balance, page3.balance]).toEqual([28, 28, 28])
    } finally {
      await removeFamilies(f.id)
    }
  })

  it('записи с одинаковым временем не теряются между страницами', async () => {
    const f = await createFamily()
    try {
      for (let i = 1; i <= 5; i++) {
        await pool.query(`insert into coin_transactions (member_id, amount, reason, created_at) values ($1, $2, $3, '2026-10-01T10:00:00Z')`, [f.kid.id, i, `р${i}`])
      }
      const seen: string[] = []
      let before = ''
      for (let guard = 0; guard < 10; guard++) {
        const { body } = await history(f.kid.token, `?limit=2${before}`)
        seen.push(...body.items.map((i: { id: string }) => i.id))
        if (!body.hasMore) break
        before = `&before=${body.items[body.items.length - 1].id}`
      }
      expect(seen).toHaveLength(5)
      expect(new Set(seen).size).toBe(5)
    } finally {
      await removeFamilies(f.id)
    }
  })

  it('before чужой или неизвестной записи ничего не раскрывает (пустая страница), параметры проверяются', async () => {
    const f = await createFamily()
    try {
      await addEntries(f.sis.id, 2)
      const foreign = (await history(f.sis.token)).body.items[0].id
      await addEntries(f.kid.id, 2)
      // чужой id в before: такой записи в истории ребёнка нет, граница не находится, страница пустая
      const { body } = await history(f.kid.token, `?before=${foreign}`)
      expect(body.items).toEqual([])
      expect(body.hasMore).toBe(false)
      expect((await history(f.kid.token, '?limit=0')).status).toBe(400)
      expect((await history(f.kid.token, '?limit=101')).status).toBe(400)
      expect((await history(f.kid.token, '?before=не-id')).status).toBe(400)
    } finally {
      await removeFamilies(f.id)
    }
  })
})

describe('автор записи', () => {
  it('при удалении участника-автора запись остаётся, автор становится «система» (null)', async () => {
    const f = await createFamily()
    try {
      await pool.query(`insert into coin_transactions (member_id, amount, reason, created_by) values ($1, 10, 'x', $2)`, [f.kid.id, f.dad.id])
      await pool.query('delete from members where id = $1', [f.dad.id])
      const { body } = await history(f.kid.token)
      expect(body.items).toHaveLength(1)
      expect(body.items[0].createdBy).toBeNull()
    } finally {
      await removeFamilies(f.id)
    }
  })
})

describe('история ребёнка для родителей (memberId)', () => {
  const asParent = (token: string, memberId: string, query = '') => api(app, token, 'GET', `/api/coins?memberId=${memberId}${query}`)

  it('родитель видит баланс и историю ребёнка своей семьи', async () => {
    const f = await createFamily()
    try {
      await addEntries(f.kid.id, 3, f.mom.id)
      const { status, body } = await asParent(f.dad.token, f.kid.id)
      expect(status).toBe(200)
      expect(body.balance).toBe(6)
      expect(body.items.map((i: { reason: string }) => i.reason)).toEqual(['запись 1', 'запись 2', 'запись 3'])
      expect(body.items[0].createdBy).toBe(f.mom.id)
      // постранично, как и у самого ребёнка
      const page2 = await asParent(f.mom.token, f.kid.id, `&limit=2&before=${body.items[1].id}`)
      expect(page2.body.items.map((i: { reason: string }) => i.reason)).toEqual(['запись 3'])
    } finally {
      await removeFamilies(f.id)
    }
  })

  it('данные те же, что видит сам ребёнок', async () => {
    const f = await createFamily()
    try {
      await addEntries(f.sis.id, 2)
      const own = (await history(f.sis.token)).body
      const viaParent = (await asParent(f.mom.token, f.sis.id)).body
      expect(viaParent).toEqual(own)
    } finally {
      await removeFamilies(f.id)
    }
  })

  it('ребёнок чужие монеты не видит (в том числе брата или сестры), свои по своему id видит', async () => {
    const f = await createFamily()
    try {
      await addEntries(f.kid.id, 1)
      const res = await asParent(f.sis.token, f.kid.id)
      expect(res.status).toBe(403)
      expect(res.body.error).toBe('forbidden')
      expect((await asParent(f.kid.token, f.kid.id)).status).toBe(200)
    } finally {
      await removeFamilies(f.id)
    }
  })

  it('нужен ребёнок своей семьи: взрослый, чужой и неизвестный id отклоняются', async () => {
    expect((await asParent(fam.mom.token, fam.dad.id)).body.error).toBe('not_a_child')
    expect((await asParent(fam.mom.token, fam.mom.id)).status).toBe(403) // сам родитель без монет
    const stranger = await createFamily()
    try {
      expect((await asParent(fam.mom.token, stranger.kid.id)).status).toBe(404)
      expect((await asParent(fam.mom.token, '00000000-0000-4000-8000-000000000000')).status).toBe(404)
      expect((await asParent(fam.mom.token, 'не-id')).status).toBe(400)
      expect((await api(app, null, 'GET', `/api/coins?memberId=${fam.kid.id}`)).status).toBe(401)
    } finally {
      await removeFamilies(stranger.id)
    }
  })

  it('чужая семья не видит монеты', async () => {
    const stranger = await createFamily()
    try {
      expect((await asParent(stranger.mom.token, fam.kid.id)).status).toBe(404)
    } finally {
      await removeFamilies(stranger.id)
    }
  })
})
