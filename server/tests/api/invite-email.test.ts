import { readFileSync } from 'node:fs'
import { randomBytes } from 'node:crypto'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { buildApp } from '../../src/app.js'
import { pool } from '../../src/db.js'
import { inviteLinkFor } from '../../src/invites.js'
import { api, createFamily, removeFamilies, type TestFamily } from '../helpers.js'

// дневной бюджет писем подменён: настоящая таблица provider_usage общая для параллельных файлов
const budget = vi.hoisted(() => ({ exhausted: false }))
vi.mock('../../src/outbox/budget.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../src/outbox/budget.js')>()),
  mailBudgetExhausted: async () => budget.exhausted,
}))

let app: Awaited<ReturnType<typeof buildApp>>
const suffix = randomBytes(4).toString('hex')
const families: TestFamily[] = []
let n = 0
const guest = () => `guest${++n}-${suffix}@invite.test.local`

// тот же образец проверяет notifier (contracts/outbox-v1.json)
const sample = JSON.parse(readFileSync(new URL('../../../contracts/outbox-v1.json', import.meta.url), 'utf8'))

async function family() {
  const f = await createFamily()
  families.push(f)
  return f
}
const invite = (token: string | null, email: string) => api(app, token, 'POST', '/api/invite/email', { email })
const mailsTo = async (email: string) =>
  (await pool.query(`select payload from outbox where channel = 'email' and payload->>'to' = $1 order by id`, [email])).rows.map((r) => r.payload)

beforeAll(async () => {
  app = await buildApp({ logger: false, rateLimit: false })
  await app.ready()
})
afterEach(() => {
  vi.unstubAllEnvs()
})
afterAll(async () => {
  await pool.query(`delete from outbox where channel = 'email' and payload->>'to' like $1`, [`%-${suffix}@invite.test.local`])
  await removeFamilies(...families.map((f) => f.id))
  await app.close()
  await pool.end()
})

describe('приглашение по email', () => {
  it('владелец: письмо со ссылкой на присоединение ставится в очередь, адрес подставлен в ссылку', async () => {
    const f = await family()
    const to = guest()
    expect((await invite(f.mom.token, to)).status).toBe(204)
    const [mail] = await mailsTo(to)
    expect(mail).toMatchObject({ v: 1, kind: 'invite', to, inviterName: 'Мама', ttlMinutes: 1440 })
    const link = new URL(mail.link)
    expect(link.pathname).toBe('/join')
    expect(link.searchParams.get('email')).toBe(to)
    // код ссылки ведёт на действующее приглашение семьи
    const code = link.searchParams.get('code')!
    expect((await api(app, null, 'GET', `/api/invites/${code}`)).status).toBe(200)
    // форма письма совпадает с общим образцом контракта
    expect(Object.keys(mail).sort()).toEqual(Object.keys(sample.emailInvite).sort())
  })

  it('использует действующую ссылку семьи и не отзывает её; если ссылки нет, выпускает новую', async () => {
    const f = await family()
    const first = (await api(app, f.mom.token, 'POST', '/api/invite')).body.code as string
    const a = guest()
    await invite(f.mom.token, a)
    expect(new URL((await mailsTo(a))[0].link).searchParams.get('code')).toBe(first)
    expect((await api(app, null, 'GET', `/api/invites/${first}`)).status).toBe(200)

    const g = await family()
    expect((await api(app, g.mom.token, 'GET', '/api/invite')).status).toBe(404)
    const b = guest()
    expect((await invite(g.mom.token, b)).status).toBe(204)
    const code = new URL((await mailsTo(b))[0].link).searchParams.get('code')!
    expect((await api(app, g.mom.token, 'GET', '/api/invite')).body.code).toBe(code)
  })

  it('адрес сайта в ссылке берётся из настроек сервера, а не из запроса', async () => {
    vi.stubEnv('PUBLIC_URL', 'https://familytasks.test/')
    expect(inviteLinkFor('abc', 'a@b.co')).toBe('https://familytasks.test/join?code=abc&email=a%40b.co')
    vi.stubEnv('PUBLIC_URL', '')
    vi.stubEnv('DOMAIN', 'family.example.com')
    expect(inviteLinkFor('abc', 'a@b.co')).toBe('https://family.example.com/join?code=abc&email=a%40b.co')
    vi.stubEnv('DOMAIN', '')
    expect(inviteLinkFor('abc', 'a@b.co')).toMatch(/^http:\/\/localhost:\d+\/join/)

    const f = await family()
    const to = guest()
    await app.inject({
      method: 'POST',
      url: '/api/invite/email',
      headers: { authorization: `Bearer ${f.mom.token}`, host: 'evil.example', origin: 'https://evil.example' },
      payload: { email: to },
    })
    expect((await mailsTo(to))[0].link).not.toContain('evil.example')
  })

  it('приглашать может только владелец; без токена 401; неверный адрес 400', async () => {
    const f = await family()
    const to = guest()
    // папа родитель, но не создатель семьи
    expect((await invite(f.dad.token, to)).status).toBe(403)
    expect((await invite(f.kid.token, to)).status).toBe(403)
    expect((await invite(null, to)).status).toBe(401)
    expect((await invite(f.mom.token, 'не-адрес')).status).toBe(400)
    expect(await mailsTo(to)).toHaveLength(0)
  })

  it('уже участник семьи: 409 already_member, письма нет (регистр адреса не важен)', async () => {
    const f = await family()
    const member = `member-${suffix}@invite.test.local`
    await pool.query(`insert into members (family_id, name, email, role) values ($1, 'Анна', $2, 'grandma')`, [f.id, member])
    const res = await invite(f.mom.token, member.toUpperCase())
    expect(res.status).toBe(409)
    expect(res.body.error).toBe('already_member')
    expect(await mailsTo(member)).toHaveLength(0)
  })

  it('семья заполнена (6 участников): 409 family_full', async () => {
    const f = await family()
    for (const name of ['Бабушка', 'Дедушка']) {
      await pool.query(`insert into members (family_id, name, email, role) values ($1, $2, $3, $4)`, [
        f.id,
        name,
        `${name === 'Бабушка' ? 'grandma' : 'grandpa'}-${suffix}-${f.id.slice(0, 6)}@invite.test.local`,
        name === 'Бабушка' ? 'grandma' : 'grandpa',
      ])
    }
    const to = guest()
    const res = await invite(f.mom.token, to)
    expect(res.status).toBe(409)
    expect(res.body.error).toBe('family_full')
    expect(await mailsTo(to)).toHaveLength(0)
  })

  it('один адрес повторно раньше чем через 10 минут: 429 too_soon, другому можно', async () => {
    const f = await family()
    const to = guest()
    expect((await invite(f.mom.token, to)).status).toBe(204)
    const again = await invite(f.mom.token, to.toUpperCase())
    expect(again.status).toBe(429)
    expect(again.body.error).toBe('too_soon')
    expect(await mailsTo(to)).toHaveLength(1)
    expect((await invite(f.mom.token, guest())).status).toBe(204)
    // через 10 минут повтор разрешён
    await pool.query(`update invite_emails set created_at = now() - interval '11 minutes' where family_id = $1 and email = $2`, [f.id, to])
    expect((await invite(f.mom.token, to)).status).toBe(204)
  })

  it('не больше 20 писем семьи в сутки: 429 invite_limit', async () => {
    const f = await family()
    await pool.query(
      `insert into invite_emails (family_id, email) select $1, 'old' || g || '@invite.test.local' from generate_series(1, 20) g`,
      [f.id],
    )
    const res = await invite(f.mom.token, guest())
    expect(res.status).toBe(429)
    expect(res.body.error).toBe('invite_limit')
    // записи старше суток не считаются
    await pool.query(`update invite_emails set created_at = now() - interval '2 days' where family_id = $1`, [f.id])
    expect((await invite(f.mom.token, guest())).status).toBe(204)
  })

  it('дневной бюджет писем исчерпан: 503 mail_busy, ничего не пишется', async () => {
    budget.exhausted = true
    try {
      const f = await family()
      const to = guest()
      const res = await invite(f.mom.token, to)
      expect(res.status).toBe(503)
      expect(res.body.error).toBe('mail_busy')
      expect(await mailsTo(to)).toHaveLength(0)
      expect((await pool.query('select 1 from invite_emails where family_id = $1', [f.id])).rowCount).toBe(0)
    } finally {
      budget.exhausted = false
    }
  })
})
