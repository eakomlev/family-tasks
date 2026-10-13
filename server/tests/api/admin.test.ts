import { randomBytes } from 'node:crypto'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { buildApp } from '../../src/app.js'
import { isAdminEmail, type QueueStats, type ServiceStats } from '../../src/admin.js'
import { pool } from '../../src/db.js'
import { mailBudgetExhausted } from '../../src/outbox/budget.js'
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

describe('GET /api/admin/queue', () => {
  const queue = async (token: string | null = fam.mom.token) => {
    const res = await api(app, token, 'GET', '/api/admin/queue')
    return { status: res.status, body: res.body as QueueStats }
  }
  const created: { outbox: string[]; beats: string[] } = { outbox: [], beats: [] }
  const insertRow = async (channel: 'email' | 'push', attempts = 0, ageSeconds = 0) => {
    const { rows } = await pool.query(
      `insert into outbox (channel, priority, payload, attempts, created_at, expires_at)
       values ($1, 1, '{"v":1}', $2, now() - make_interval(secs => $3), now() + interval '1 hour') returning id`,
      [channel, attempts, ageSeconds],
    )
    created.outbox.push(rows[0].id)
  }

  afterEach(async () => {
    vi.unstubAllEnvs()
    await pool.query('delete from outbox where id = any($1)', [created.outbox])
    await pool.query('delete from notifier_heartbeat where instance = any($1)', [created.beats])
    await pool.query(`delete from provider_usage where provider = 'mail'`)
    await pool.query(`delete from delivery_stats where channel in ('email', 'push')`)
    created.outbox = []
    created.beats = []
  })

  it('не администратору раздела нет (404), без токена 401', async () => {
    expect((await queue(fam.kid.token)).status).toBe(404)
    expect((await queue(null)).status).toBe(401)
  })

  it('отдаёт состояние: что ждёт, что в повторах, возраст старшей строки', async () => {
    await insertRow('email')
    await insertRow('push')
    await insertRow('push')
    await insertRow('push', 1, 600) // уже пробовалась, лежит десять минут

    // таблица общая с параллельными тестами (они ставят и убирают свои письма), поэтому проверяем нижние границы:
    // свои строки на месте, пока идёт запрос
    const { waiting, retrying, oldestSeconds } = (await queue()).body
    expect(waiting.email).toBeGreaterThanOrEqual(1)
    expect(waiting.push).toBeGreaterThanOrEqual(2)
    expect(retrying).toBeGreaterThanOrEqual(1)
    expect(oldestSeconds).toBeGreaterThanOrEqual(600)
  })

  it('состояние notifier: свежая метка это живой экземпляр, старая нет', async () => {
    // метки пишет только notifier, а его тесты работают в другой базе: здесь можно проверять точно
    const fresh = `test-${randomBytes(3).toString('hex')}`
    const stale = `test-${randomBytes(3).toString('hex')}`
    created.beats.push(fresh, stale)

    await pool.query(`insert into notifier_heartbeat (instance, beat_at) values ($1, now() - interval '10 minutes')`, [stale])
    expect((await queue()).body.notifier).toMatchObject({ alive: false, instances: 0 })
    expect((await queue()).body.notifier.lastBeatSeconds).toBeGreaterThanOrEqual(600)

    await pool.query(`insert into notifier_heartbeat (instance, beat_at) values ($1, now() - interval '5 seconds')`, [fresh])
    const { notifier } = (await queue()).body
    expect(notifier).toMatchObject({ alive: true, instances: 1 })
    expect(notifier.lastBeatSeconds).toBeLessThan(60)
  })

  it('расход дневного бюджета почты и лимит', async () => {
    await pool.query(`insert into provider_usage (provider, day, count) values ('mail', (now() at time zone 'UTC')::date, 1240)
                      on conflict (provider, day) do update set count = 1240`)
    vi.stubEnv('MAIL_DAILY_LIMIT', '3000')
    expect((await queue()).body.mail).toEqual({ usedToday: 1240, limit: 3000 })
    vi.stubEnv('MAIL_DAILY_LIMIT', '0')
    expect((await queue()).body.mail.limit).toBe(0)
  })

  it('итоги отправки за сегодня по UTC', async () => {
    await pool.query(`insert into delivery_stats (channel, day, sent, failed) values
      ('email', (now() at time zone 'UTC')::date, 7, 2), ('push', (now() at time zone 'UTC')::date, 40, 1),
      ('push', (now() at time zone 'UTC')::date - 1, 999, 999)`)
    expect((await queue()).body.today).toEqual({ email: { sent: 7, failed: 2 }, push: { sent: 40, failed: 1 } })
  })

  it('нагрузка на бюджет: отправленное сегодня плюс ждущее в очереди (mailBudgetExhausted)', async () => {
    await pool.query(`insert into provider_usage (provider, day, count) values ('mail', (now() at time zone 'UTC')::date, 1240)
                      on conflict (provider, day) do update set count = 1240`)
    // нагрузка не меньше 1240, что бы ни лежало в общей очереди
    vi.stubEnv('MAIL_DAILY_LIMIT', '1240')
    expect(await mailBudgetExhausted(pool)).toBe(true)
    vi.stubEnv('MAIL_DAILY_LIMIT', '1000000')
    expect(await mailBudgetExhausted(pool)).toBe(false)
    vi.stubEnv('MAIL_DAILY_LIMIT', '0')
    expect(await mailBudgetExhausted(pool)).toBe(false)
  })
})

describe('признак администратора в /api/me', () => {
  it('isAdmin только у администратора', async () => {
    expect((await api(app, fam.mom.token, 'GET', '/api/me')).body.member.isAdmin).toBe(true)
    expect((await api(app, fam.dad.token, 'GET', '/api/me')).body.member.isAdmin).toBe(false)
  })
})
