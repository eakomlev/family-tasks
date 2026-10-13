import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('web-push', () => ({
  default: { setVapidDetails: vi.fn(), sendNotification: vi.fn(async () => ({ statusCode: 201 })) },
}))

import { buildApp } from '../../src/app.js'
import { pool } from '../../src/db.js'
import { api, createFamily, removeFamilies, type TestFamily } from '../helpers.js'
import { resetSent, sentTo, subscribe } from '../webpush.js'

let app: Awaited<ReturnType<typeof buildApp>>
let fam: TestFamily
let other: TestFamily
let momEp: string
let dadEp: string
let kidEp: string

beforeAll(async () => {
  app = await buildApp({ logger: false, rateLimit: false })
  await app.ready()
  fam = await createFamily()
  other = await createFamily()
  momEp = await subscribe(fam.mom.id)
  dadEp = await subscribe(fam.dad.id)
  kidEp = await subscribe(fam.kid.id)
})
beforeEach(async () => {
  await resetSent()
})
afterAll(async () => {
  await removeFamilies(fam.id, other.id)
  await app.close()
  await pool.end()
})

const give = (memberId: string, amount: number) =>
  pool.query(`insert into coin_transactions (member_id, amount, reason) values ($1, $2, 'тест')`, [memberId, amount])
const balance = async (token: string) => (await api(app, token, 'GET', '/api/me')).body.member.coins as number
const create = (token: string, memberId: string, body: object) => api(app, token, 'POST', `/api/members/${memberId}/goals`, body)
const pushes = async (...eps: string[]) => {
  await new Promise((r) => setTimeout(r, 150))
  return (await sentTo(eps))
}
const png = 'data:image/png;base64,iVBORw0KGgo='

describe('создание и просмотр', () => {
  it('родитель создаёт цель, её видят родители и сам ребёнок; другой ребёнок и чужая семья нет', async () => {
    const res = await create(fam.mom.token, fam.kid.id, { title: ' Лего ', price: 300, url: 'https://shop.example/lego', image: png })
    expect(res.status).toBe(201)
    expect(res.body.goal).toMatchObject({ memberId: fam.kid.id, title: 'Лего', price: 300, url: 'https://shop.example/lego', image: png, purchasedAt: null })

    for (const token of [fam.mom.token, fam.dad.token, fam.kid.token]) {
      const list = await api(app, token, 'GET', `/api/members/${fam.kid.id}/goals`)
      expect(list.status).toBe(200)
      expect(list.body.goals.map((g: { title: string }) => g.title)).toContain('Лего')
    }
    expect((await api(app, fam.sis.token, 'GET', `/api/members/${fam.kid.id}/goals`)).status).toBe(403)
    expect((await api(app, other.mom.token, 'GET', `/api/members/${fam.kid.id}/goals`)).status).toBe(404)
    expect((await api(app, fam.sis.token, 'GET', `/api/goals/${res.body.goal.id}`)).status).toBe(404)
  })

  it('ребёнок цели не создаёт, нельзя цель взрослому, данные проверяются', async () => {
    expect((await create(fam.kid.token, fam.kid.id, { title: 'Х', price: 5 })).status).toBe(403)
    expect((await create(fam.mom.token, fam.dad.id, { title: 'Х', price: 5 })).status).toBe(400)
    for (const body of [{ title: '  ', price: 5 }, { title: 'Х', price: 0 }, { title: 'Х', price: 1.5 }, { title: 'Х', price: 5, url: 'javascript:alert(1)' }, { title: 'Х', price: 5, image: 'data:text/html;base64,AAAA' }]) {
      expect((await create(fam.mom.token, fam.kid.id, body)).status).toBe(400)
    }
  })

  it('изменение и удаление только у родителей; ребёнок цель не меняет', async () => {
    const { goal } = (await create(fam.mom.token, fam.sis.id, { title: 'Книга', price: 50 })).body
    expect((await api(app, fam.sis.token, 'PUT', `/api/goals/${goal.id}`, { title: 'Другое', price: 1 })).status).toBe(403)
    expect((await api(app, fam.sis.token, 'DELETE', `/api/goals/${goal.id}`)).status).toBe(403)
    const upd = await api(app, fam.dad.token, 'PUT', `/api/goals/${goal.id}`, { title: 'Большая книга', price: 70, url: null, image: null })
    expect(upd.body.goal).toMatchObject({ title: 'Большая книга', price: 70 })
    expect((await api(app, fam.mom.token, 'DELETE', `/api/goals/${goal.id}`)).status).toBe(204)
    expect((await api(app, fam.mom.token, 'GET', `/api/goals/${goal.id}`)).status).toBe(404)
  })
})

describe('оплата', () => {
  it('не хватает монет: 409 и сколько не хватает, ничего не списывается', async () => {
    await give(fam.kid.id, 100)
    const { goal } = (await create(fam.mom.token, fam.kid.id, { title: 'Самокат', price: 500 })).body
    const before = await balance(fam.kid.token)
    const res = await api(app, fam.kid.token, 'POST', `/api/goals/${goal.id}/purchase`)
    expect(res.status).toBe(409)
    expect(res.body).toMatchObject({ error: 'not_enough_coins', missing: 500 - before })
    expect(await balance(fam.kid.token)).toBe(before)
  })

  it('хватает: монеты списаны, запись в истории, цель куплена, родителям пуш; повторно купить нельзя', async () => {
    const { goal } = (await create(fam.mom.token, fam.kid.id, { title: 'Наклейки', price: 40 })).body
    await give(fam.kid.id, 1000)
    const before = await balance(fam.kid.token)

    const res = await api(app, fam.kid.token, 'POST', `/api/goals/${goal.id}/purchase`)
    expect(res.status).toBe(200)
    expect(res.body.goal.purchasedAt).not.toBeNull()
    expect(res.body.balance).toBe(before - 40)
    expect(await balance(fam.kid.token)).toBe(before - 40)

    const history = (await api(app, fam.kid.token, 'GET', '/api/coins')).body.items[0]
    expect(history).toMatchObject({ amount: -40, reason: 'Цель: Наклейки' })

    const got = await pushes(momEp, dadEp, kidEp)
    expect(got.map((g) => g.endpoint).sort()).toEqual([momEp, dadEp].sort())
    expect(got[0].payload).toMatchObject({ title: 'Цель куплена', url: `/goals/${goal.id}` })
    expect(got[0].payload.body).toContain('Наклейки')

    expect((await api(app, fam.kid.token, 'POST', `/api/goals/${goal.id}/purchase`)).body.error).toBe('already_purchased')
    expect(await balance(fam.kid.token)).toBe(before - 40)
    // купленную менять нельзя, удалить можно, список: купленные в конце
    expect((await api(app, fam.mom.token, 'PUT', `/api/goals/${goal.id}`, { title: 'Х', price: 1 })).body.error).toBe('already_purchased')
  })

  it('платит только сам ребёнок: родитель и другой ребёнок нет', async () => {
    const { goal } = (await create(fam.mom.token, fam.kid.id, { title: 'Мяч', price: 10 })).body
    expect((await api(app, fam.mom.token, 'POST', `/api/goals/${goal.id}/purchase`)).status).toBe(403)
    expect((await api(app, fam.sis.token, 'POST', `/api/goals/${goal.id}/purchase`)).status).toBe(404)
  })

  it('два одновременных нажатия покупают цель один раз', async () => {
    const { goal } = (await create(fam.mom.token, fam.kid.id, { title: 'Один раз', price: 25 })).body
    await give(fam.kid.id, 1000)
    const before = await balance(fam.kid.token)
    const results = await Promise.all([1, 2, 3].map(() => api(app, fam.kid.token, 'POST', `/api/goals/${goal.id}/purchase`)))
    expect(results.filter((r) => r.status === 200)).toHaveLength(1)
    expect(await balance(fam.kid.token)).toBe(before - 25)
  })

  it('в списке купленные идут после остальных', async () => {
    const list = (await api(app, fam.kid.token, 'GET', `/api/members/${fam.kid.id}/goals`)).body.goals as { purchasedAt: string | null }[]
    const firstBought = list.findIndex((g) => g.purchasedAt)
    expect(firstBought).toBeGreaterThan(-1)
    expect(list.slice(firstBought).every((g) => g.purchasedAt)).toBe(true)
  })
})
