import { randomBytes } from 'node:crypto'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { buildApp } from '../../src/app.js'
import { CONSENT_VERSION } from '../../src/consent.js'
import { pool } from '../../src/db.js'
import { api, createFamily, removeFamilies, type TestFamily } from '../helpers.js'

let app: Awaited<ReturnType<typeof buildApp>>
const domain = `consent-${randomBytes(3).toString('hex')}.test`
let n = 0
let fam: TestFamily

const lastCode = async (to: string) =>
  (await pool.query(`select payload->>'code' as code from outbox where channel = 'email' and payload->>'to' = $1 order by id desc limit 1`, [to])).rows[0].code as string
const requestCode = (to: string) => api(app, null, 'POST', '/api/email-codes', { email: to, purpose: 'signup' })

beforeAll(async () => {
  app = await buildApp({ logger: false, rateLimit: false })
  await app.ready()
  fam = await createFamily()
})
beforeEach(async () => {
  await pool.query(`delete from outbox where channel = 'email' and payload->>'to' like $1`, [`%@${domain}`])
})
afterAll(async () => {
  await pool.query(`delete from outbox where channel = 'email' and payload->>'to' like $1`, [`%@${domain}`])
  await pool.query(`delete from email_codes where email like $1`, [`%@${domain}`])
  await pool.query(`delete from families where id in (select family_id from members where email like $1)`, [`%@${domain}`])
  await removeFamilies(fam.id)
  await app.close()
  await pool.end()
})

const create = async (extra: object = { consent: true }) => {
  const to = `u${++n}@${domain}`
  await requestCode(to)
  return { to, res: await api(app, null, 'POST', '/api/families', { role: 'mama', name: 'Лена', email: to, code: await lastCode(to), ...extra }) }
}

describe('согласие на обработку персональных данных', () => {
  it('создание семьи без согласия отклоняется, участник не создаётся, код остаётся годным', async () => {
    const { to, res } = await create({})
    expect(res.status).toBe(400)
    expect(res.body).toEqual({ error: 'consent_required' })
    expect((await pool.query('select 1 from members where email = $1', [to])).rowCount).toBe(0)
    // согласие не true: тоже отказ; с согласием тем же кодом семья создаётся
    const code = await lastCode(to)
    expect((await api(app, null, 'POST', '/api/families', { role: 'mama', name: 'Лена', email: to, code, consent: false })).status).toBe(400)
    expect((await api(app, null, 'POST', '/api/families', { role: 'mama', name: 'Лена', email: to, code, consent: true })).status).toBe(201)
  })

  it('с согласием: версия и время записываются, согласие в /api/me не требуется', async () => {
    const { to, res } = await create()
    expect(res.status).toBe(201)
    const { rows } = await pool.query('select consent_version, consent_at from members where email = $1', [to])
    expect(rows[0].consent_version).toBe(CONSENT_VERSION)
    expect(Date.now() - new Date(rows[0].consent_at).getTime()).toBeLessThan(60_000)
    const me = await api(app, res.body.member.token, 'GET', '/api/me')
    expect(me.body.member.consentRequired).toBe(false)
  })

  it('присоединение по приглашению тоже требует согласия', async () => {
    const owner = (await create()).res
    const to = `j${++n}@${domain}`
    await requestCode(to)
    const body = { role: 'papa', name: 'Игорь', email: to, code: await lastCode(to) }
    const code = owner.body.invite.code
    const without = await api(app, null, 'POST', `/api/invites/${code}/join`, body)
    expect(without.status).toBe(400)
    expect(without.body).toEqual({ error: 'consent_required' })
    expect((await api(app, null, 'POST', `/api/invites/${code}/join`, { ...body, consent: true })).status).toBe(201)
  })

  it('у участника без согласия (был до этой версии) /api/me требует согласиться, POST /api/me/consent фиксирует', async () => {
    const old = fam.kid
    await pool.query('update members set consent_version = null, consent_at = null where id = $1', [old.id])
    expect((await api(app, old.token, 'GET', '/api/me')).body.member.consentRequired).toBe(true)

    expect((await api(app, null, 'POST', '/api/me/consent')).status).toBe(401)
    expect((await api(app, old.token, 'POST', '/api/me/consent')).status).toBe(204)
    expect((await api(app, old.token, 'GET', '/api/me')).body.member.consentRequired).toBe(false)
    const { rows } = await pool.query('select consent_version from members where id = $1', [old.id])
    expect(rows[0].consent_version).toBe(CONSENT_VERSION)
  })

  it('устаревшая редакция согласия тоже требует согласиться заново', async () => {
    await pool.query(`update members set consent_version = '2020-01-01', consent_at = now() where id = $1`, [fam.mom.id])
    expect((await api(app, fam.mom.token, 'GET', '/api/me')).body.member.consentRequired).toBe(true)
  })
})
