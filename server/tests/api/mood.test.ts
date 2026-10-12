import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { buildApp } from '../../src/app.js'
import { pool } from '../../src/db.js'
import { api, createFamily, removeFamilies, type TestFamily } from '../helpers.js'

let app: Awaited<ReturnType<typeof buildApp>>
let fam: TestFamily

beforeAll(async () => {
  app = await buildApp({ logger: false, rateLimit: false })
  await app.ready()
  fam = await createFamily()
})
afterAll(async () => {
  await removeFamilies(fam.id)
  await app.close()
  await pool.end()
})

const set = (token: string, mood: unknown) => api(app, token, 'PUT', '/api/me/mood', { mood })
const me = async (token: string) => (await api(app, token, 'GET', '/api/me')).body

describe('настроение ребёнка', () => {
  it('сначала настроения нет; ребёнок выбирает, и его видят все в семье, в том числе его самого в /me', async () => {
    expect((await me(fam.kid.token)).member.mood).toBeNull()

    const res = await set(fam.kid.token, 4)
    expect(res.status).toBe(200)
    expect(res.body.mood.value).toBe(4)

    for (const token of [fam.mom.token, fam.sis.token, fam.kid.token]) {
      const body = await me(token)
      const kid = body.members.find((m: { id: string }) => m.id === fam.kid.id)
      expect(kid.mood).toMatchObject({ value: 4 })
      expect(typeof kid.mood.at).toBe('string')
    }
    expect((await me(fam.kid.token)).member.mood).toMatchObject({ value: 4 })
  })

  it('можно сменить; время выбора обновляется', async () => {
    const first = (await me(fam.kid.token)).member.mood.at
    await new Promise((r) => setTimeout(r, 20))
    await set(fam.kid.token, 1)
    const after = (await me(fam.kid.token)).member.mood
    expect(after.value).toBe(1)
    expect(after.at > first).toBe(true)
  })

  it('родители настроение не ставят, значение проверяется, без токена нельзя', async () => {
    expect((await set(fam.mom.token, 3)).status).toBe(403)
    for (const bad of [0, 6, 2.5, 'радость', null]) expect((await set(fam.kid.token, bad)).status).toBe(400)
    expect((await api(app, null, 'PUT', '/api/me/mood', { mood: 3 })).status).toBe(401)
    // у родителей поля настроения нет
    const mom = (await me(fam.kid.token)).members.find((m: { id: string }) => m.id === fam.mom.id)
    expect(mom.mood).toBeNull()
  })
})
