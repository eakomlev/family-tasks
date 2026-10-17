import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { buildApp } from '../../src/app.js'
import { pool } from '../../src/db.js'
import { api, createFamily, removeFamilies, type TestFamily } from '../helpers.js'

let app: Awaited<ReturnType<typeof buildApp>>
let fam: TestFamily
let other: TestFamily

beforeAll(async () => {
  app = await buildApp({ logger: false, rateLimit: false })
  await app.ready()
  fam = await createFamily()
  other = await createFamily()
})
afterAll(async () => {
  await removeFamilies(fam.id, other.id)
  await app.close()
  await pool.end()
})

const request = (token: string | null) => api(app, token, 'POST', '/api/family/deletion')
const rows = async (familyId: string) => (await pool.query('select * from family_deletions where family_id = $1', [familyId])).rows

describe('заявка на удаление семьи', () => {
  it('без входа 401, остальные участники 403, заявки нет', async () => {
    expect((await request(null)).status).toBe(401)
    for (const who of [fam.dad, fam.kid, fam.sis]) expect((await request(who.token)).status).toBe(403)
    expect(await rows(fam.id)).toHaveLength(0)
  })

  it('создатель оставляет заявку: 202, данные пока на месте, заявка к немедленному исполнению', async () => {
    const res = await request(fam.mom.token)
    expect(res.status).toBe(202)
    expect(res.body.requestedAt).toBeTruthy()
    const [row] = await rows(fam.id)
    expect(row).toMatchObject({ requested_by: fam.mom.id, attempts: 0, last_error: null })
    expect(new Date(row.next_attempt_at).getTime()).toBeLessThanOrEqual(Date.now())
    // ничего не удалено сразу: это работа планировщика
    expect((await api(app, fam.dad.token, 'GET', '/api/me')).status).toBe(200)
  })

  it('повторная заявка ничего не меняет и отвечает тем же временем', async () => {
    const first = (await rows(fam.id))[0]
    const again = await request(fam.mom.token)
    expect(again.status).toBe(202)
    expect(new Date(again.body.requestedAt).getTime()).toBe(new Date(first.requested_at).getTime())
    expect(await rows(fam.id)).toHaveLength(1)
  })

  it('чужая семья не затронута', async () => {
    expect(await rows(other.id)).toHaveLength(0)
  })

  it('заявка исчезает вместе с семьёй (каскад)', async () => {
    const f = await createFamily()
    await request(f.mom.token)
    expect(await rows(f.id)).toHaveLength(1)
    await removeFamilies(f.id)
    expect(await rows(f.id)).toHaveLength(0)
  })
})
