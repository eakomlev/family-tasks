import { randomBytes } from 'node:crypto'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

// письма не отправляем, а запоминаем: из них берём коды
vi.mock('../../src/mail.js', () => ({ sendCode: vi.fn(async () => {}) }))

import { buildApp } from '../../src/app.js'
import { pool } from '../../src/db.js'
import { sendCode } from '../../src/mail.js'
import { api } from '../helpers.js'

type App = Awaited<ReturnType<typeof buildApp>>

// у всех адресов этого файла общий уникальный домен: по нему убираем за собой
const domain = `auth-${randomBytes(3).toString('hex')}.test`
const email = (name: string) => `${name}@${domain}`
let app: App
let n = 0

// последний код, отправленный на адрес
const lastCode = (to: string): string => {
  const call = vi.mocked(sendCode).mock.calls.filter(([addr]) => addr === to).at(-1)
  if (!call) throw new Error(`на ${to} ничего не отправлялось`)
  return call[1]
}
const sentTo = (to: string) => vi.mocked(sendCode).mock.calls.filter(([addr]) => addr === to).length

async function requestCode(to: string, purpose: 'signup' | 'login') {
  return api(app, null, 'POST', '/api/email-codes', { email: to, purpose })
}

// Регистрация через API: код на почту, создание семьи.
async function registerFamily(name: string, address = email(`user${++n}`)) {
  await requestCode(address, 'signup')
  const res = await api(app, null, 'POST', '/api/families', { role: 'mama', name, email: address, code: lastCode(address) })
  return { address, ...res }
}

beforeAll(async () => {
  app = await buildApp({ logger: false, rateLimit: false })
})
beforeEach(() => {
  vi.mocked(sendCode).mockClear()
})
afterAll(async () => {
  await pool.query(`delete from email_codes where email like $1`, [`%@${domain}`])
  await pool.query(`delete from families where id in (select family_id from members where email like $1)`, [`%@${domain}`])
  await app.close()
  await pool.end()
})

describe('отправка кода', () => {
  it('отправляет письмо на адрес в нижнем регистре и отвечает 204', async () => {
    const res = await requestCode(email('MixedCase'), 'signup')
    expect(res.status).toBe(204)
    expect(sentTo(email('mixedcase'))).toBe(1)
    expect(lastCode(email('mixedcase'))).toMatch(/^\d{6}$/)
  })

  it('повторный запрос раньше чем через минуту отклоняется', async () => {
    const to = email('cooldown')
    expect((await requestCode(to, 'signup')).status).toBe(204)
    const second = await requestCode(to, 'signup')
    expect(second.status).toBe(429)
    expect(second.body).toEqual({ error: 'too_soon' })
    expect(sentTo(to)).toBe(1)
  })

  it('для входа неизвестному адресу письмо не уходит, но ответ тот же (адреса нельзя перебирать)', async () => {
    const to = email('nobody')
    const res = await requestCode(to, 'login')
    expect(res.status).toBe(204)
    expect(sentTo(to)).toBe(0)
    // и ограничение «раз в минуту» тоже не выдаёт, есть ли адрес
    expect((await requestCode(to, 'login')).status).toBe(429)
  })

  it('проверяет формат адреса и назначение', async () => {
    expect((await api(app, null, 'POST', '/api/email-codes', { email: 'not-an-email', purpose: 'signup' })).status).toBe(400)
    expect((await api(app, null, 'POST', '/api/email-codes', { email: email('x'), purpose: 'reset' })).status).toBe(400)
  })
})

describe('создание семьи', () => {
  it('с верным кодом создаёт семью, владельца, сессию и приглашение', async () => {
    const { status, body } = await registerFamily('Лена')
    expect(status).toBe(201)
    expect(body.member).toMatchObject({ name: 'Лена', role: 'mama', isOwner: true })
    expect(body.member.token).toHaveLength(43)
    expect(body.family.code).toMatch(/^[a-z0-9]{8}$/)
    expect(body.invite.code).toHaveLength(22)
    const me = await api(app, body.member.token, 'GET', '/api/me')
    expect(me.body.member).toMatchObject({ name: 'Лена', isOwner: true })
  })

  it('неверный код не создаёт ничего, а использованный код сжигается', async () => {
    const to = email('onetime')
    await requestCode(to, 'signup')
    const code = lastCode(to)
    const wrong = code === '000000' ? '000001' : '000000'
    const bad = await api(app, null, 'POST', '/api/families', { role: 'mama', name: 'А', email: to, code: wrong })
    expect(bad).toMatchObject({ status: 400, body: { error: 'invalid_code' } })
    expect((await api(app, null, 'POST', '/api/families', { role: 'mama', name: 'А', email: to, code })).status).toBe(201)
    expect((await api(app, null, 'POST', '/api/families', { role: 'mama', name: 'Б', email: to, code })).status).toBe(400)
  })

  it('создателем может быть только мама или папа', async () => {
    const to = email('childowner')
    await requestCode(to, 'signup')
    const res = await api(app, null, 'POST', '/api/families', { role: 'child', name: 'Ребёнок', email: to, code: lastCode(to) })
    expect(res.status).toBe(400)
  })

  it('просроченный код не подходит', async () => {
    const to = email('expired')
    await requestCode(to, 'signup')
    await pool.query(`update email_codes set expires_at = now() - interval '1 minute' where email = $1`, [to])
    const res = await api(app, null, 'POST', '/api/families', { role: 'papa', name: 'Папа', email: to, code: lastCode(to) })
    expect(res.body).toEqual({ error: 'invalid_code' })
  })

  it('после 5 неверных попыток верный код тоже не принимается', async () => {
    const to = email('lockout')
    await requestCode(to, 'signup')
    const code = lastCode(to)
    const wrong = code === '111111' ? '222222' : '111111'
    for (let i = 0; i < 5; i++) {
      await api(app, null, 'POST', '/api/families', { role: 'mama', name: 'А', email: to, code: wrong })
    }
    const res = await api(app, null, 'POST', '/api/families', { role: 'mama', name: 'А', email: to, code })
    expect(res.status).toBe(400)
  })
})

describe('присоединение по приглашению', () => {
  it('создаёт участника с выбранной ролью и сессией', async () => {
    const owner = await registerFamily('Хозяйка')
    const to = email('kid1')
    await requestCode(to, 'signup')
    const join = await api(app, null, 'POST', `/api/invites/${owner.body.invite.code}/join`, { role: 'child', name: 'Миша', email: to, code: lastCode(to) })
    expect(join.status).toBe(201)
    expect(join.body.member).toMatchObject({ name: 'Миша', role: 'child', isOwner: false })
    expect(join.body.family.code).toBe(owner.body.family.code)
    const me = await api(app, join.body.member.token, 'GET', '/api/me')
    expect(me.body.members.map((m: { name: string }) => m.name)).toEqual(['Хозяйка', 'Миша'])
  })

  it('имя и email в семье уникальны', async () => {
    const owner = await registerFamily('Семья')
    const join = async (name: string, address: string) => {
      await requestCode(address, 'signup')
      return api(app, null, 'POST', `/api/invites/${owner.body.invite.code}/join`, { role: 'papa', name, email: address, code: lastCode(address) })
    }
    expect((await join('Игорь', email('igor'))).status).toBe(201)
    expect((await join('игорь', email('igor2'))).body).toEqual({ error: 'name_taken' })
    expect((await join('Другой', email('igor'))).body).toEqual({ error: 'email_taken' })
  })

  it('чужой или просроченный код приглашения', async () => {
    const owner = await registerFamily('Старшая')
    expect((await api(app, null, 'GET', '/api/invites/does-not-exist')).status).toBe(404)
    expect((await api(app, null, 'GET', `/api/invites/${owner.body.invite.code}`)).status).toBe(200)

    await pool.query(`update invites set expires_at = now() - interval '1 day' where code = $1`, [owner.body.invite.code])
    expect((await api(app, null, 'GET', `/api/invites/${owner.body.invite.code}`)).body).toEqual({ error: 'invite_expired' })
    const to = email('late')
    await requestCode(to, 'signup')
    const join = await api(app, null, 'POST', `/api/invites/${owner.body.invite.code}/join`, { role: 'child', name: 'Опоздал', email: to, code: lastCode(to) })
    expect(join.status).toBe(410)
  })
})

describe('вход по коду', () => {
  it('вход создаёт независимую сессию, выход отзывает только её', async () => {
    const owner = await registerFamily('Вход')
    await requestCode(owner.address, 'login')
    const first = await api(app, null, 'POST', '/api/auth/login', { email: owner.address, code: lastCode(owner.address) })
    expect(first.status).toBe(201)
    expect(first.body.member).toMatchObject({ name: 'Вход', role: 'mama', isOwner: true })

    const token = first.body.member.token
    expect((await api(app, token, 'GET', '/api/me')).status).toBe(200)
    expect((await api(app, token, 'DELETE', '/api/session')).status).toBe(204)
    expect((await api(app, token, 'GET', '/api/me')).status).toBe(401)
    // сессия, полученная при создании семьи, осталась рабочей
    expect((await api(app, owner.body.member.token, 'GET', '/api/me')).status).toBe(200)
  })

  it('неверный код и код, которого не запрашивали', async () => {
    const owner = await registerFamily('Ошибка')
    expect((await api(app, null, 'POST', '/api/auth/login', { email: owner.address, code: '123456' })).body).toEqual({ error: 'invalid_code' })
    await requestCode(owner.address, 'login')
    const code = lastCode(owner.address)
    const wrong = code === '123456' ? '654321' : '123456'
    expect((await api(app, null, 'POST', '/api/auth/login', { email: owner.address, code: wrong })).status).toBe(401)
  })

  it('код входа не подходит для регистрации и наоборот', async () => {
    const owner = await registerFamily('Назначение')
    await requestCode(owner.address, 'login')
    const res = await api(app, null, 'POST', '/api/families', { role: 'papa', name: 'Х', email: owner.address, code: lastCode(owner.address) })
    expect(res.body).toEqual({ error: 'invalid_code' })
  })

  it('если email в нескольких семьях, предлагает выбор и не сжигает код', async () => {
    const shared = email('shared')
    const a = await registerFamily('Первая', shared)
    const b = await registerFamily('Вторая', shared)
    expect(a.body.family.code).not.toBe(b.body.family.code)

    await requestCode(shared, 'login')
    const code = lastCode(shared)
    const choose = await api(app, null, 'POST', '/api/auth/login', { email: shared, code })
    expect(choose.status).toBe(409)
    expect(choose.body.error).toBe('choose_member')
    expect(choose.body.options.map((o: { name: string }) => o.name).sort()).toEqual(['Вторая', 'Первая'])
    expect(choose.body.options[0].familyMembers).toHaveLength(1)

    const second = choose.body.options.find((o: { name: string }) => o.name === 'Вторая')
    const done = await api(app, null, 'POST', '/api/auth/login', { email: shared, code, memberId: second.id })
    expect(done.status).toBe(201)
    expect(done.body.family.code).toBe(b.body.family.code)
    // теперь код израсходован
    expect((await api(app, null, 'POST', '/api/auth/login', { email: shared, code, memberId: second.id })).status).toBe(401)
  })

  it('выбрать участника с чужим memberId нельзя', async () => {
    const shared = email('shared2')
    await registerFamily('Одна', shared)
    await registerFamily('Другая', shared)
    const stranger = await registerFamily('Чужая')
    const strangerId = (await api(app, stranger.body.member.token, 'GET', '/api/me')).body.member.id
    await requestCode(shared, 'login')
    const res = await api(app, null, 'POST', '/api/auth/login', { email: shared, code: lastCode(shared), memberId: strangerId })
    expect(res.status).toBe(400)
  })
})

describe('защита эндпоинтов', () => {
  it('без токена и с чужим токеном все закрытые запросы дают 401', async () => {
    for (const [method, url] of [['GET', '/api/me'], ['PATCH', '/api/me'], ['GET', '/api/invite']] as const) {
      expect((await api(app, null, method, url, method === 'PATCH' ? { name: 'x' } : undefined)).status).toBe(401)
      expect((await api(app, 'definitely-not-a-token', method, url, method === 'PATCH' ? { name: 'x' } : undefined)).status).toBe(401)
    }
  })

  it('выход без токена 401, а с недействительным токеном безвреден (204, идемпотентно)', async () => {
    expect((await api(app, null, 'DELETE', '/api/session')).status).toBe(401)
    expect((await api(app, 'definitely-not-a-token', 'DELETE', '/api/session')).status).toBe(204)
  })

  it('health отвечает', async () => {
    expect((await api(app, null, 'GET', '/api/health')).body).toEqual({ status: 'ok' })
  })
})
