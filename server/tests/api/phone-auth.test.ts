import { randomInt } from 'node:crypto'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { buildApp } from '../../src/app.js'
import { pool } from '../../src/db.js'
import { api as rawApi } from '../helpers.js'

type App = Awaited<ReturnType<typeof buildApp>>

// как у соседних тестов, но с привычными statusCode и json()
const api = async (...args: Parameters<typeof rawApi>) => {
  const res = await rawApi(...args)
  return { statusCode: res.status, json: () => res.body }
}

// Номера этого файла: общий случайный префикс, по нему убираем за собой (файлы тестов идут параллельно и делят таблицы)
const prefix = String(randomInt(100_000, 999_999))
const phone = (i: number) => `+7915${prefix.slice(0, 3)}${String(i).padStart(4, '0')}`
const mailAddr = (name: string) => `${name}@phone-auth-${prefix}.test`
const allPhones = () => Array.from({ length: 30 }, (_, i) => phone(i))
let app: App
let n = 0

// SMS ставятся в очередь outbox (канал sms), коды берём оттуда
const lastCode = async (to: string): Promise<string> => {
  const { rows } = await pool.query(`select payload->>'code' as code from outbox where channel = 'sms' and payload->>'to' = $1 order by id desc limit 1`, [to])
  if (!rows[0]) throw new Error(`на ${to} ничего не отправлялось`)
  return rows[0].code
}
const smsTo = async (to: string) => (await pool.query(`select 1 from outbox where channel = 'sms' and payload->>'to' = $1`, [to])).rowCount ?? 0
const requestCode = (to: string, purpose: 'signup' | 'login') => api(app, null, 'POST', '/api/email-codes', { phone: to, purpose })

async function registerFamily(name: string, number = phone(++n)) {
  await requestCode(number, 'signup')
  const res = await api(app, null, 'POST', '/api/families', { consent: true, role: 'mama', name, phone: number, code: await lastCode(number) })
  return { number, ...res }
}

async function cleanup() {
  await pool.query(`delete from outbox where channel = 'sms' and payload->>'to' = any($1)`, [allPhones()])
  await pool.query(`delete from outbox where channel = 'email' and payload->>'to' like $1`, [`%@phone-auth-${prefix}.test`])
  await pool.query('delete from email_codes where email = any($1) or email like $2', [allPhones().map((p) => `tel:${p}`), `%@phone-auth-${prefix}.test`])
}

beforeAll(async () => {
  app = await buildApp({ logger: false, rateLimit: false })
})
beforeEach(cleanup)
afterAll(async () => {
  await cleanup()
  await pool.query(`delete from families where id in (select family_id from members where phone = any($1) or email like $2)`, [allPhones(), `%@phone-auth-${prefix}.test`])
  await app.close()
  await pool.end()
})

describe('код на телефон', () => {
  it('SMS с шестизначным кодом ставится в очередь на нормализованный номер', async () => {
    const res = await api(app, null, 'POST', '/api/email-codes', { phone: '8 (915) ' + phone(1).slice(5, 8) + '-' + phone(1).slice(8, 10) + '-' + phone(1).slice(10), purpose: 'signup' })
    expect(res.statusCode).toBe(204)
    expect(await lastCode(phone(1))).toMatch(/^\d{6}$/)
    const { rows } = await pool.query(`select channel, priority, payload from outbox where channel = 'sms' and payload->>'to' = $1`, [phone(1)])
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ channel: 'sms', priority: 0, payload: { v: 1, kind: 'code', to: phone(1), ttlMinutes: 10 } })
    // письма при этом никто не ждёт
    expect((await pool.query(`select 1 from outbox where channel = 'email' and payload->>'to' = $1`, [phone(1)])).rowCount).toBe(0)
  })

  it('неверные номера и неправильное сочетание полей', async () => {
    expect((await requestCode('+380501234567', 'signup')).json()).toEqual({ error: 'invalid_phone' })
    expect((await requestCode('+74951234567', 'signup')).json()).toEqual({ error: 'invalid_phone' })
    expect((await api(app, null, 'POST', '/api/email-codes', { phone: phone(2), email: mailAddr('x'), purpose: 'signup' })).json()).toEqual({ error: 'contact_required' })
    expect((await api(app, null, 'POST', '/api/email-codes', { purpose: 'signup' })).statusCode).toBe(400)
    expect(await smsTo(phone(2))).toBe(0)
  })

  it('повторный запрос раньше чем через минуту: 429 too_soon, второго SMS нет', async () => {
    expect((await requestCode(phone(3), 'signup')).statusCode).toBe(204)
    expect((await requestCode(phone(3), 'signup')).json()).toEqual({ error: 'too_soon' })
    expect(await smsTo(phone(3))).toBe(1)
  })

  it('для SMS пауза повтора две минуты: через 90 секунд ещё 429, через 130 можно', async () => {
    expect((await requestCode(phone(30), 'signup')).statusCode).toBe(204)
    const shift = (seconds: number) => pool.query(`update email_codes set created_at = now() - make_interval(secs => $2) where email = $1`, [`tel:${phone(30)}`, seconds])
    await shift(90)
    expect((await requestCode(phone(30), 'signup')).json()).toEqual({ error: 'too_soon' })
    await shift(130)
    expect((await requestCode(phone(30), 'signup')).statusCode).toBe(204)
    expect(await smsTo(phone(30))).toBe(2)
  })

  it('при входе SMS уходит только известному номеру, а ответ одинаков', async () => {
    const { number } = await registerFamily('Лена')
    await pool.query(`delete from outbox where channel = 'sms' and payload->>'to' = $1`, [number])
    await pool.query('delete from email_codes where email = $1', [`tel:${number}`])
    const known = await requestCode(number, 'login')
    const unknown = await requestCode(phone(25), 'login')
    expect(known.statusCode).toBe(204)
    expect(unknown.statusCode).toBe(204)
    expect(await smsTo(number)).toBe(1)
    expect(await smsTo(phone(25))).toBe(0)
  })

  it('код для email и для телефона не пересекаются', async () => {
    await requestCode(phone(4), 'signup')
    const res = await api(app, null, 'POST', '/api/families', { consent: true, role: 'mama', name: 'Лена', email: phone(4), code: await lastCode(phone(4)) })
    expect(res.statusCode).toBe(400)
  })
})

describe('регистрация и вход по телефону', () => {
  it('создание семьи по телефону: участник без email, /api/me отдаёт номер', async () => {
    const res = await registerFamily('Лена')
    expect(res.statusCode).toBe(201)
    const me = await api(app, res.json().member.token, 'GET', '/api/me')
    expect(me.json().member).toMatchObject({ name: 'Лена', phone: res.number, email: null, isAdmin: false })
  })

  it('неверный код не даёт создать семью', async () => {
    await requestCode(phone(5), 'signup')
    const res = await api(app, null, 'POST', '/api/families', { consent: true, role: 'mama', name: 'Лена', phone: phone(5), code: '000000' === (await lastCode(phone(5))) ? '111111' : '000000' })
    expect(res.statusCode).toBe(400)
    expect(res.json()).toEqual({ error: 'invalid_code' })
  })

  it('вход по телефону и коду создаёт сессию', async () => {
    const { number } = await registerFamily('Лена')
    await pool.query('delete from email_codes where email = $1', [`tel:${number}`])
    await requestCode(number, 'login')
    const login = await api(app, null, 'POST', '/api/auth/login', { phone: number, code: await lastCode(number) })
    expect(login.statusCode).toBe(201)
    expect(login.json().member).toMatchObject({ name: 'Лена', role: 'mama', isOwner: true })
    expect(login.json().member.token).toBeTruthy()
  })

  it('вход с неверным кодом и по неизвестному номеру: 401', async () => {
    const { number } = await registerFamily('Лена')
    await pool.query('delete from email_codes where email = $1', [`tel:${number}`])
    await requestCode(number, 'login')
    const code = await lastCode(number)
    expect((await api(app, null, 'POST', '/api/auth/login', { phone: number, code: code === '111111' ? '222222' : '111111' })).statusCode).toBe(401)
    expect((await api(app, null, 'POST', '/api/auth/login', { phone: phone(26), code })).statusCode).toBe(401)
  })

  it('один номер в двух семьях: 409 choose_member, потом вход с выбранным участником', async () => {
    const a = await registerFamily('Лена', phone(6))
    // тот же номер во второй семье: присоединение по приглашению
    const b = await registerFamily('Ольга', phone(7))
    await pool.query('update members set phone = $1 where family_id = (select family_id from members where phone = $2)', [phone(6), phone(7)])
    expect(a.statusCode).toBe(201)
    expect(b.statusCode).toBe(201)
    await pool.query('delete from email_codes where email = $1', [`tel:${phone(6)}`])
    await requestCode(phone(6), 'login')
    const code = await lastCode(phone(6))
    const first = await api(app, null, 'POST', '/api/auth/login', { phone: phone(6), code })
    expect(first.statusCode).toBe(409)
    expect(first.json().error).toBe('choose_member')
    expect(first.json().options).toHaveLength(2)
    const chosen = first.json().options[0].id
    const second = await api(app, null, 'POST', '/api/auth/login', { phone: phone(6), code, memberId: chosen })
    expect(second.statusCode).toBe(201)
    expect(second.json().member.id).toBe(chosen)
  })

  it('присоединение по приглашению с телефоном; тот же номер в той же семье: 409 phone_taken', async () => {
    const owner = await registerFamily('Лена', phone(8))
    const invite = owner.json().invite.code
    await requestCode(phone(9), 'signup')
    const joined = await api(app, null, 'POST', `/api/invites/${invite}/join`, { consent: true, role: 'papa', name: 'Игорь', phone: phone(9), code: await lastCode(phone(9)) })
    expect(joined.statusCode).toBe(201)

    await pool.query('delete from email_codes where email = $1', [`tel:${phone(9)}`])
    await requestCode(phone(9), 'signup')
    const again = await api(app, null, 'POST', `/api/invites/${invite}/join`, { consent: true, role: 'child', name: 'Миша', phone: phone(9), code: await lastCode(phone(9)) })
    expect(again.statusCode).toBe(409)
    expect(again.json()).toEqual({ error: 'phone_taken' })
  })

  it('в семье могут быть участники и с email, и с телефоном', async () => {
    const owner = await registerFamily('Лена', phone(10))
    const invite = owner.json().invite.code
    const address = mailAddr('igor')
    await api(app, null, 'POST', '/api/email-codes', { email: address, purpose: 'signup' })
    const { rows } = await pool.query(`select payload->>'code' as code from outbox where channel = 'email' and payload->>'to' = $1 order by id desc limit 1`, [address])
    const joined = await api(app, null, 'POST', `/api/invites/${invite}/join`, { consent: true, role: 'papa', name: 'Игорь', email: address, code: rows[0].code })
    expect(joined.statusCode).toBe(201)
    const me = await api(app, owner.json().member.token, 'GET', '/api/me')
    expect(me.json().members.map((m: { name: string }) => m.name)).toEqual(['Лена', 'Игорь'])
  })
})

describe('бюджет SMS', () => {
  const filler: string[] = []
  afterEach(async () => {
    vi.unstubAllEnvs()
    await pool.query('delete from outbox where id = any($1)', [filler.splice(0)])
  })

  it('бюджет исчерпан: 503 sms_busy, SMS не ставится, код и пауза не создаются', async () => {
    const { rows } = await pool.query(
      `insert into outbox (channel, priority, payload, expires_at) values ('sms', 0, $1, now() + interval '10 minutes') returning id`,
      [JSON.stringify({ v: 1, kind: 'code', to: phone(27), code: '000000', ttlMinutes: 10 })],
    )
    filler.push(rows[0].id)
    vi.stubEnv('SMS_DAILY_LIMIT', '1')
    const res = await requestCode(phone(11), 'signup')
    expect(res.statusCode).toBe(503)
    expect(res.json()).toEqual({ error: 'sms_busy' })
    expect(await smsTo(phone(11))).toBe(0)
    expect((await pool.query('select 1 from email_codes where email = $1', [`tel:${phone(11)}`])).rowCount).toBe(0)
    // почта при этом работает: у неё свой бюджет
    expect((await api(app, null, 'POST', '/api/email-codes', { email: mailAddr('busy'), purpose: 'signup' })).statusCode).toBe(204)
  })

  it('SMS_DAILY_LIMIT=0 снимает ограничение', async () => {
    vi.stubEnv('SMS_DAILY_LIMIT', '0')
    expect((await requestCode(phone(12), 'signup')).statusCode).toBe(204)
  })
})

describe('телефон в профиле', () => {
  it('добавить номер к участнику с email: код на новый номер, подтверждение, потом вход по нему', async () => {
    const address = mailAddr('lena')
    await api(app, null, 'POST', '/api/email-codes', { email: address, purpose: 'signup' })
    const mailCode = (await pool.query(`select payload->>'code' as code from outbox where channel = 'email' and payload->>'to' = $1 order by id desc limit 1`, [address])).rows[0].code
    const created = await api(app, null, 'POST', '/api/families', { consent: true, role: 'mama', name: 'Лена', email: address, code: mailCode })
    const token = created.json().member.token

    expect((await api(app, token, 'POST', '/api/me/phone-code', { phone: phone(13) })).statusCode).toBe(204)
    const code = await lastCode(phone(13))
    expect((await api(app, token, 'PUT', '/api/me/phone', { phone: phone(13), code: code === '111111' ? '222222' : '111111' })).json()).toEqual({ error: 'invalid_code' })
    const ok = await api(app, token, 'PUT', '/api/me/phone', { phone: phone(13), code })
    expect(ok.statusCode).toBe(200)
    expect(ok.json()).toEqual({ phone: phone(13) })
    expect((await api(app, token, 'GET', '/api/me')).json().member).toMatchObject({ email: address, phone: phone(13) })

    // теперь по номеру можно войти
    await requestCode(phone(13), 'login')
    const login = await api(app, null, 'POST', '/api/auth/login', { phone: phone(13), code: await lastCode(phone(13)) })
    expect(login.statusCode).toBe(201)
    expect(login.json().member.name).toBe('Лена')

    // и номер можно убрать, пока есть email
    expect((await api(app, token, 'DELETE', '/api/me/phone')).statusCode).toBe(204)
    expect((await api(app, token, 'GET', '/api/me')).json().member.phone).toBeNull()
  })

  it('номер другого участника семьи занять нельзя, без токена и с неверным номером отказ', async () => {
    const owner = await registerFamily('Лена', phone(14))
    const token = owner.json().member.token
    const invite = owner.json().invite.code
    await requestCode(phone(15), 'signup')
    const joined = await api(app, null, 'POST', `/api/invites/${invite}/join`, { consent: true, role: 'papa', name: 'Игорь', phone: phone(15), code: await lastCode(phone(15)) })
    const second = joined.json().member.token

    expect((await api(app, second, 'POST', '/api/me/phone-code', { phone: phone(14) })).json()).toEqual({ error: 'phone_taken' })
    expect((await api(app, null, 'POST', '/api/me/phone-code', { phone: phone(16) })).statusCode).toBe(401)
    expect((await api(app, token, 'POST', '/api/me/phone-code', { phone: '+380501234567' })).json()).toEqual({ error: 'invalid_phone' })
  })

  it('единственный способ входа убрать нельзя', async () => {
    const owner = await registerFamily('Лена', phone(17))
    const res = await api(app, owner.json().member.token, 'DELETE', '/api/me/phone')
    expect(res.statusCode).toBe(400)
    expect(res.json()).toEqual({ error: 'last_contact' })
  })
})
