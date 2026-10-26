import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { buildApp } from '../../src/app.js'
import type { SmsStats } from '../../src/admin.js'
import { pool } from '../../src/db.js'
import { api, createFamily, removeFamilies, type TestFamily } from '../helpers.js'

let app: Awaited<ReturnType<typeof buildApp>>
let fam: TestFamily
const envBefore = process.env.ADMIN_EMAILS
const outboxIds: string[] = []

beforeAll(async () => {
  app = await buildApp({ logger: false, rateLimit: false })
  await app.ready()
  fam = await createFamily()
  await pool.query(`update members set email = 'boss@test.local' where id = $1`, [fam.mom.id])
})
// таблицы provider_balance, а также строки sms в delivery_stats и provider_usage пишет только этот файл (и notifier в своей базе):
// проверять можно точно
const clean = async () => {
  await pool.query('delete from provider_balance')
  await pool.query(`delete from delivery_stats where channel = 'sms'`)
  await pool.query(`delete from provider_usage where provider = 'sms'`)
  await pool.query('delete from outbox where id = any($1)', [outboxIds.splice(0)])
}
beforeEach(clean)
afterEach(() => {
  process.env.ADMIN_EMAILS = envBefore
  vi.unstubAllEnvs()
})
afterAll(async () => {
  await clean()
  await removeFamilies(fam.id)
  await app.close()
  await pool.end()
})

const sms = async (token: string | null = fam.mom.token) => {
  const res = await api(app, token, 'GET', '/api/admin/sms')
  return { status: res.status, body: res.body as SmsStats }
}
const day = (offset: number) => `(now() at time zone 'UTC')::date - ${offset}`
const stat = (offset: number, sent: number, failed: number, spend: number) =>
  pool.query(`insert into delivery_stats (channel, day, sent, failed, spend) values ('sms', ${day(offset)}, $1, $2, $3)`, [sent, failed, spend])
const queued = async (attempts: number) => {
  const { rows } = await pool.query(
    `insert into outbox (channel, priority, payload, attempts, expires_at) values ('sms', 0, '{"v":1}', $1, now() + interval '1 hour') returning id`,
    [attempts],
  )
  outboxIds.push(rows[0].id)
}

describe('GET /api/admin/sms', () => {
  it('не администратору раздела нет (404), без токена 401', async () => {
    expect((await sms(fam.kid.token)).status).toBe(404)
    expect((await sms(null)).status).toBe(401)
  })

  it('пока notifier не записал остаток, SMS считаются ненастроенными, остальное нули', async () => {
    const { status, body } = await sms()
    expect(status).toBe(200)
    expect(body).toMatchObject({
      configured: false,
      balance: { amount: null, checkedSeconds: null, error: null },
      today: { sent: 0, failed: 0, spend: 0 },
      week: { sent: 0, failed: 0, spend: 0 },
      days: [],
      limit: 100,
      usedToday: 0,
    })
    // очередь общая с параллельными тестами (строки sms ставит phone-auth.test.ts): точное число не проверяем
    expect(body.waiting).toBeGreaterThanOrEqual(0)
    expect(body.retrying).toBeGreaterThanOrEqual(0)
  })

  it('остаток на счёте и давность проверки', async () => {
    await pool.query(`insert into provider_balance (provider, balance, checked_at) values ('smsaero', 530.22, now() - interval '90 seconds')`)
    const { balance, configured } = (await sms()).body
    expect(configured).toBe(true)
    expect(balance.amount).toBe(530.22)
    expect(balance.checkedSeconds).toBeGreaterThanOrEqual(90)
    expect(balance.checkedSeconds).toBeLessThan(120)
    expect(balance.error).toBeNull()
  })

  it('ошибка проверки приходит рядом с последним известным остатком', async () => {
    await pool.query(`insert into provider_balance (provider, balance, checked_at, error) values ('smsaero', 12.5, now() - interval '1 hour', 'balance 401 Unauthorized')`)
    const { balance } = (await sms()).body
    expect(balance).toMatchObject({ amount: 12.5, error: 'balance 401 Unauthorized' })
    expect(balance.checkedSeconds).toBeGreaterThanOrEqual(3600)
  })

  it('расход и отправки: сегодня, за неделю и по дням (старше семи суток не входит)', async () => {
    await stat(0, 5, 1, 49.45)
    await stat(1, 3, 0, 29.67)
    await stat(6, 2, 2, 19.78)
    await stat(7, 100, 100, 999) // восьмые сутки: за пределами недели
    const { today, week, days } = (await sms()).body
    expect(today).toEqual({ sent: 5, failed: 1, spend: 49.45 })
    expect(week).toEqual({ sent: 10, failed: 3, spend: 98.9 })
    expect(days).toHaveLength(3)
    // свежие первыми
    expect(days[0]).toMatchObject({ sent: 5, failed: 1, spend: 49.45 })
    expect(days[2]).toMatchObject({ sent: 2, failed: 2, spend: 19.78 })
  })

  it('очередь: ждущие и в повторах считаются по каналу sms', async () => {
    await queued(0)
    await queued(0)
    await queued(2)
    const { waiting, retrying } = (await sms()).body
    // у таблицы outbox параллельные тесты других файлов: у них нет строк канала sms, кроме фонового наполнения в phone-auth.test.ts
    expect(waiting).toBeGreaterThanOrEqual(2)
    expect(retrying).toBeGreaterThanOrEqual(1)
  })

  it('дневной потолок и сколько уже использовано', async () => {
    await pool.query(`insert into provider_usage (provider, day, count) values ('sms', (now() at time zone 'UTC')::date, 37)`)
    expect((await sms()).body).toMatchObject({ limit: 100, usedToday: 37 })
    vi.stubEnv('SMS_DAILY_LIMIT', '250')
    expect((await sms()).body.limit).toBe(250)
    vi.stubEnv('SMS_DAILY_LIMIT', '0')
    expect((await sms()).body.limit).toBe(0)
  })
})
