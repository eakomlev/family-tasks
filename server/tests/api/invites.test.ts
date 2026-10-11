import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { buildApp } from '../../src/app.js'
import { pool } from '../../src/db.js'
import { api, createFamily, removeFamilies, type TestFamily } from '../helpers.js'

let app: Awaited<ReturnType<typeof buildApp>>
let fam: TestFamily

beforeAll(async () => {
  app = await buildApp({ logger: false, rateLimit: false })
  fam = await createFamily()
  await pool.query(`insert into invites (family_id, code, expires_at) values ($1, $2, now() + interval '7 days')`, [fam.id, `inv-${fam.id}`])
})
afterAll(async () => {
  await removeFamilies(fam.id)
  await app.close()
  await pool.end()
})

describe('приглашение владельца', () => {
  it('владелец видит действующее приглашение', async () => {
    const res = await api(app, fam.mom.token, 'GET', '/api/invite')
    expect(res.status).toBe(200)
    expect(res.body.code).toBe(`inv-${fam.id}`)
  })

  it('остальные участники (родитель не владелец и дети) получают 403', async () => {
    for (const member of [fam.dad, fam.kid]) {
      expect((await api(app, member.token, 'GET', '/api/invite')).status).toBe(403)
      expect((await api(app, member.token, 'POST', '/api/invite')).status).toBe(403)
    }
  })

  it('без токена 401', async () => {
    expect((await api(app, null, 'GET', '/api/invite')).status).toBe(401)
  })

  it('новое приглашение отзывает старое', async () => {
    const old = `inv-${fam.id}`
    expect((await api(app, null, 'GET', `/api/invites/${old}`)).status).toBe(200)

    const fresh = await api(app, fam.mom.token, 'POST', '/api/invite')
    expect(fresh.status).toBe(201)
    expect(fresh.body.code).not.toBe(old)
    expect(new Date(fresh.body.expiresAt).getTime()).toBeGreaterThan(Date.now() + 6 * 24 * 3600 * 1000)

    expect((await api(app, null, 'GET', `/api/invites/${old}`)).status).toBe(404)
    expect((await api(app, null, 'GET', `/api/invites/${fresh.body.code}`)).status).toBe(200)
    expect((await api(app, fam.mom.token, 'GET', '/api/invite')).body.code).toBe(fresh.body.code)
  })

  it('просроченное приглашение: проверка 410, у владельца активного нет (404)', async () => {
    const { body } = await api(app, fam.mom.token, 'GET', '/api/invite')
    await pool.query(`update invites set expires_at = now() - interval '1 day' where code = $1`, [body.code])
    expect((await api(app, null, 'GET', `/api/invites/${body.code}`)).status).toBe(410)
    expect((await api(app, fam.mom.token, 'GET', '/api/invite')).status).toBe(404)
  })
})
