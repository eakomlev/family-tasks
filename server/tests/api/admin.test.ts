import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { buildApp } from '../../src/app.js'
import { isAdminEmail, type ServiceStats } from '../../src/admin.js'
import { pool } from '../../src/db.js'
import { api, createFamily, removeFamilies, type TestFamily } from '../helpers.js'

let app: Awaited<ReturnType<typeof buildApp>>
let fam: TestFamily
const envBefore = process.env.ADMIN_EMAILS

beforeAll(async () => {
  app = await buildApp({ logger: false, rateLimit: false })
  await app.ready()
  fam = await createFamily()
  // мама этой семьи администратор: её почта входит в ADMIN_EMAILS из конфигурации тестов (регистр в списке другой)
  await pool.query(`update members set email = 'boss@test.local' where id = $1`, [fam.mom.id])
})
afterEach(() => {
  process.env.ADMIN_EMAILS = envBefore
})
afterAll(async () => {
  await removeFamilies(fam.id)
  await app.close()
  await pool.end()
})

const since = (offsetMs = 0) => new Date(Date.now() + offsetMs).toISOString()
const stats = (token: string | null, from = since(-60_000)) => api(app, token, 'GET', `/api/admin/stats?since=${encodeURIComponent(from)}`)

describe('isAdminEmail', () => {
  it('список через запятую, пробелы и регистр не важны; пусто или нет в списке: нет', () => {
    process.env.ADMIN_EMAILS = ' A@x.ru ,b@x.ru ,, '
    expect(isAdminEmail('a@X.RU')).toBe(true)
    expect(isAdminEmail('B@x.ru')).toBe(true)
    expect(isAdminEmail('c@x.ru')).toBe(false)
    expect(isAdminEmail('')).toBe(false)
    expect(isAdminEmail(null)).toBe(false)
    process.env.ADMIN_EMAILS = ''
    expect(isAdminEmail('a@x.ru')).toBe(false)
    delete process.env.ADMIN_EMAILS
    expect(isAdminEmail('a@x.ru')).toBe(false)
  })
})

describe('GET /api/admin/stats', () => {
  it('администратору отдаёт сводку: аккаунты, семьи, сообщения, всего и за сегодня', async () => {
    const res = await stats(fam.mom.token)
    expect(res.status).toBe(200)
    const body = res.body as ServiceStats
    for (const key of ['accounts', 'families', 'messages'] as const) {
      expect(body[key].total).toBeGreaterThanOrEqual(body[key].today)
      expect(Number.isInteger(body[key].total)).toBe(true)
    }
    expect(body.accounts.total).toBeGreaterThanOrEqual(4)
  })

  it('новые участники и сообщения попадают и во «всего», и в «сегодня»', async () => {
    // с запасом в несколько секунд: часы базы (в Docker) могут слегка отставать от часов теста.
    // Сравниваем не прирост «всего» (параллельные тесты удаляют свои семьи), а «сегодня» после своих действий: свои данные никто не удалит
    const from = since(-10_000)
    const other = await createFamily()
    try {
      for (const text of ['раз', 'два', 'три']) {
        expect((await api(app, other.mom.token, 'POST', '/api/chats/family/messages', { text })).status).toBe(201)
      }
      const after = (await stats(fam.mom.token, from)).body as ServiceStats
      expect(after.accounts.today).toBeGreaterThanOrEqual(4)
      expect(after.families.today).toBeGreaterThanOrEqual(1)
      expect(after.messages.today).toBeGreaterThanOrEqual(3)
      for (const key of ['accounts', 'families', 'messages'] as const) expect(after[key].total).toBeGreaterThanOrEqual(after[key].today)
    } finally {
      await removeFamilies(other.id)
    }
  })

  it('«сегодня» считается от переданного начала дня: в будущем нет ничего', async () => {
    const res = await stats(fam.mom.token, since(60 * 60 * 1000))
    expect(res.body.accounts.today).toBe(0)
    expect(res.body.families.today).toBe(0)
    expect(res.body.messages.today).toBe(0)
    expect(res.body.accounts.total).toBeGreaterThan(0)
  })

  it('не администратору раздела нет (404, как у несуществующего адреса); без токена 401', async () => {
    for (const member of [fam.dad, fam.kid]) {
      const res = await stats(member.token)
      expect(res.status).toBe(404)
      expect(res.body).toEqual({ error: 'not_found' })
    }
    expect((await stats(null)).status).toBe(401)
  })

  it('ADMIN_EMAILS пуст: администраторов нет вообще', async () => {
    process.env.ADMIN_EMAILS = ''
    expect((await stats(fam.mom.token)).status).toBe(404)
  })

  it('без since или с мусором 400', async () => {
    expect((await api(app, fam.mom.token, 'GET', '/api/admin/stats')).status).toBe(400)
    expect((await api(app, fam.mom.token, 'GET', '/api/admin/stats?since=вчера')).status).toBe(400)
  })
})

describe('признак администратора в /api/me', () => {
  it('isAdmin только у администратора', async () => {
    expect((await api(app, fam.mom.token, 'GET', '/api/me')).body.member.isAdmin).toBe(true)
    expect((await api(app, fam.dad.token, 'GET', '/api/me')).body.member.isAdmin).toBe(false)
  })
})
