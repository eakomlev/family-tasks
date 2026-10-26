import { randomBytes } from 'node:crypto'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { buildApp } from '../../src/app.js'
import { pool } from '../../src/db.js'
import * as outbox from '../../src/outbox/index.js'
import { api } from '../helpers.js'

type App = Awaited<ReturnType<typeof buildApp>>

// у всех адресов этого файла общий уникальный домен: по нему убираем за собой
const domain = `auth-${randomBytes(3).toString('hex')}.test`
const email = (name: string) => `${name}@${domain}`
let app: App
let n = 0

// Письма отправляет notifier, server ставит их в очередь outbox: коды берём оттуда.
// Последний код, поставленный в очередь для адреса
const lastCode = async (to: string): Promise<string> => {
  const { rows } = await pool.query(
    `select payload->>'code' as code from outbox where channel = 'email' and payload->>'to' = $1 order by id desc limit 1`,
    [to],
  )
  if (!rows[0]) throw new Error(`на ${to} ничего не отправлялось`)
  return rows[0].code
}
const sentTo = async (to: string): Promise<number> =>
  (await pool.query(`select 1 from outbox where channel = 'email' and payload->>'to' = $1`, [to])).rowCount ?? 0

async function requestCode(to: string, purpose: 'signup' | 'login') {
  return api(app, null, 'POST', '/api/email-codes', { email: to, purpose })
}

// Регистрация через API: код на почту, создание семьи.
async function registerFamily(name: string, address = email(`user${++n}`)) {
  await requestCode(address, 'signup')
  const res = await api(app, null, 'POST', '/api/families', { consent: true, role: 'mama', name, email: address, code: await lastCode(address) })
  return { address, ...res }
}

beforeAll(async () => {
  app = await buildApp({ logger: false, rateLimit: false })
})
beforeEach(async () => {
  await pool.query(`delete from outbox where channel = 'email' and payload->>'to' like $1`, [`%@${domain}`])
})
afterAll(async () => {
  await pool.query(`delete from outbox where channel = 'email' and payload->>'to' like $1`, [`%@${domain}`])
  await pool.query(`delete from email_codes where email like $1`, [`%@${domain}`])
  await pool.query(`delete from families where id in (select family_id from members where email like $1)`, [`%@${domain}`])
  await app.close()
  await pool.end()
})

// Бюджет писем (MAIL_DAILY_LIMIT): когда он исчерпан, API честно отказывает, пока код всё равно не дошёл бы.
// Файлы тестов идут параллельно и делят таблицы, поэтому здесь не пишем в provider_usage (его читает admin.test.ts):
// бюджет исчерпываем собственной строкой в очереди и лимитом 1 (нагрузка не меньше 1, что бы ни делали соседи).
describe('бюджет писем', () => {
  const filler: string[] = []
  const fillQueue = async () => {
    const { rows } = await pool.query(
      `insert into outbox (channel, priority, payload, expires_at)
       values ('email', 0, $1, now() + interval '10 minutes') returning id`,
      [JSON.stringify({ v: 1, kind: 'code', to: `filler@${domain}`, code: '000000', ttlMinutes: 10 })],
    )
    filler.push(rows[0].id)
  }
  const codesFor = async (to: string) => (await pool.query('select 1 from email_codes where email = $1', [to])).rowCount
  const queuedFor = async (to: string) => (await pool.query(`select 1 from outbox where payload->>'to' = $1`, [to])).rowCount

  afterEach(async () => {
    vi.unstubAllEnvs()
    await pool.query('delete from outbox where id = any($1)', [filler.splice(0)])
  })

  it('бюджет исчерпан: 503 mail_busy, письмо не ставится, код и пауза не создаются', async () => {
    await fillQueue()
    vi.stubEnv('MAIL_DAILY_LIMIT', '1')
    const to = email('busy')

    const res = await requestCode(to, 'signup')

    expect(res.status).toBe(503)
    expect(res.body).toEqual({ error: 'mail_busy' })
    expect(await queuedFor(to)).toBe(0)
    expect(await codesFor(to)).toBe(0)
    // бюджет освободился: повтор проходит сразу, без паузы «раз в минуту»
    vi.stubEnv('MAIL_DAILY_LIMIT', '1000000')
    expect((await requestCode(to, 'signup')).status).toBe(204)
  })

  it('ответ одинаков для известного и неизвестного адреса: по нему нельзя перебирать email', async () => {
    const known = email('known-busy')
    await registerFamily('Известный', known)
    await fillQueue()
    vi.stubEnv('MAIL_DAILY_LIMIT', '1')

    const forKnown = await requestCode(known, 'login')
    const forUnknown = await requestCode(email('unknown-busy'), 'login')

    expect(forKnown.status).toBe(503)
    expect(forUnknown.status).toBe(503)
    expect(forKnown.body).toEqual(forUnknown.body)
  })

  it('пока бюджет не исчерпан, письма ставятся как обычно', async () => {
    await fillQueue()
    vi.stubEnv('MAIL_DAILY_LIMIT', '1000000')
    expect((await requestCode(email('has-budget'), 'signup')).status).toBe(204)
  })

  it('лимит 0 отключает проверку', async () => {
    await fillQueue()
    vi.stubEnv('MAIL_DAILY_LIMIT', '0')
    expect((await requestCode(email('unlimited'), 'signup')).status).toBe(204)
  })
})

// Код и письмо в очереди фиксируются одной транзакцией: либо есть и то и другое, либо ничего.
describe('код и письмо вместе', () => {
  const codeRow = async (to: string, purpose: string) =>
    (await pool.query('select 1 from email_codes where email = $1 and purpose = $2', [to, purpose])).rowCount
  const queued = async (to: string) => (await pool.query(`select 1 from outbox where payload->>'to' = $1`, [to])).rowCount

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('успех: код записан и письмо стоит в очереди', async () => {
    const to = email('atomic-ok')
    expect((await requestCode(to, 'signup')).status).toBe(204)
    expect(await codeRow(to, 'signup')).toBe(1)
    expect(await queued(to)).toBe(1)
  })

  it('регистрация: сбой очереди откатывает код, ответ 500, пауза не включается', async () => {
    const to = email('atomic-signup')
    vi.spyOn(outbox, 'enqueue').mockRejectedValueOnce(new Error('очередь недоступна'))

    const res = await requestCode(to, 'signup')

    expect(res.status).toBe(500)
    expect(res.body).toEqual({ error: 'internal_error' })
    expect(await codeRow(to, 'signup')).toBe(0)
    expect(await queued(to)).toBe(0)
    // очередь снова работает: повтор проходит сразу, без «раз в минуту»
    vi.restoreAllMocks()
    expect((await requestCode(to, 'signup')).status).toBe(204)
    expect(await queued(to)).toBe(1)
  })

  it('вход: сбой очереди для известного адреса не заметен снаружи (204, как у неизвестного), код не остаётся', async () => {
    const known = email('atomic-login')
    await registerFamily('Известный', known)
    await pool.query('delete from outbox where payload->>\'to\' = $1', [known])
    await pool.query('delete from email_codes where email = $1', [known])
    vi.spyOn(outbox, 'enqueue').mockRejectedValueOnce(new Error('очередь недоступна'))

    const forKnown = await requestCode(known, 'login')
    const forUnknown = await requestCode(email('atomic-nobody'), 'login')

    expect(forKnown.status).toBe(204)
    expect(forKnown.status).toBe(forUnknown.status)
    expect(forKnown.body).toEqual(forUnknown.body)
    expect(await codeRow(known, 'login')).toBe(0)
    expect(await queued(known)).toBe(0)
  })

  it('вход неизвестному адресу: код записан (чтобы пауза не выдавала адрес), письма нет', async () => {
    const to = email('atomic-unknown')
    expect((await requestCode(to, 'login')).status).toBe(204)
    expect(await codeRow(to, 'login')).toBe(1)
    expect(await queued(to)).toBe(0)
  })

  it('пауза «раз в минуту» не создаёт лишней строки в очереди', async () => {
    const to = email('atomic-cooldown')
    await requestCode(to, 'signup')
    expect((await requestCode(to, 'signup')).status).toBe(429)
    expect(await queued(to)).toBe(1)
  })
})

describe('отправка кода', () => {
  it('отправляет письмо на адрес в нижнем регистре и отвечает 204', async () => {
    const res = await requestCode(email('MixedCase'), 'signup')
    expect(res.status).toBe(204)
    expect(await sentTo(email('mixedcase'))).toBe(1)
    expect(await lastCode(email('mixedcase'))).toMatch(/^\d{6}$/)
  })

  it('повторный запрос раньше чем через минуту отклоняется', async () => {
    const to = email('cooldown')
    expect((await requestCode(to, 'signup')).status).toBe(204)
    const second = await requestCode(to, 'signup')
    expect(second.status).toBe(429)
    expect(second.body).toEqual({ error: 'too_soon' })
    expect(await sentTo(to)).toBe(1)
  })

  it('для входа неизвестному адресу письмо не уходит, но ответ тот же (адреса нельзя перебирать)', async () => {
    const to = email('nobody')
    const res = await requestCode(to, 'login')
    expect(res.status).toBe(204)
    expect(await sentTo(to)).toBe(0)
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
    const code = await lastCode(to)
    const wrong = code === '000000' ? '000001' : '000000'
    const bad = await api(app, null, 'POST', '/api/families', { consent: true, role: 'mama', name: 'А', email: to, code: wrong })
    expect(bad).toMatchObject({ status: 400, body: { error: 'invalid_code' } })
    expect((await api(app, null, 'POST', '/api/families', { consent: true, role: 'mama', name: 'А', email: to, code })).status).toBe(201)
    expect((await api(app, null, 'POST', '/api/families', { consent: true, role: 'mama', name: 'Б', email: to, code })).status).toBe(400)
  })

  it('создателем может быть только мама или папа', async () => {
    const to = email('childowner')
    await requestCode(to, 'signup')
    const res = await api(app, null, 'POST', '/api/families', { consent: true, role: 'child', name: 'Ребёнок', email: to, code: await lastCode(to) })
    expect(res.status).toBe(400)
  })

  it('просроченный код не подходит', async () => {
    const to = email('expired')
    await requestCode(to, 'signup')
    await pool.query(`update email_codes set expires_at = now() - interval '1 minute' where email = $1`, [to])
    const res = await api(app, null, 'POST', '/api/families', { consent: true, role: 'papa', name: 'Папа', email: to, code: await lastCode(to) })
    expect(res.body).toEqual({ error: 'invalid_code' })
  })

  it('после 5 неверных попыток верный код тоже не принимается', async () => {
    const to = email('lockout')
    await requestCode(to, 'signup')
    const code = await lastCode(to)
    const wrong = code === '111111' ? '222222' : '111111'
    for (let i = 0; i < 5; i++) {
      await api(app, null, 'POST', '/api/families', { consent: true, role: 'mama', name: 'А', email: to, code: wrong })
    }
    const res = await api(app, null, 'POST', '/api/families', { consent: true, role: 'mama', name: 'А', email: to, code })
    expect(res.status).toBe(400)
  })
})

describe('присоединение по приглашению', () => {
  it('создаёт участника с выбранной ролью и сессией', async () => {
    const owner = await registerFamily('Хозяйка')
    const to = email('kid1')
    await requestCode(to, 'signup')
    const join = await api(app, null, 'POST', `/api/invites/${owner.body.invite.code}/join`, { consent: true, role: 'child', name: 'Миша', email: to, code: await lastCode(to) })
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
      return api(app, null, 'POST', `/api/invites/${owner.body.invite.code}/join`, { consent: true, role: 'papa', name, email: address, code: await lastCode(address) })
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
    const join = await api(app, null, 'POST', `/api/invites/${owner.body.invite.code}/join`, { consent: true, role: 'child', name: 'Опоздал', email: to, code: await lastCode(to) })
    expect(join.status).toBe(410)
  })
})

describe('вход по коду', () => {
  it('вход создаёт независимую сессию, выход отзывает только её', async () => {
    const owner = await registerFamily('Вход')
    await requestCode(owner.address, 'login')
    const first = await api(app, null, 'POST', '/api/auth/login', { email: owner.address, code: await lastCode(owner.address) })
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
    const code = await lastCode(owner.address)
    const wrong = code === '123456' ? '654321' : '123456'
    expect((await api(app, null, 'POST', '/api/auth/login', { email: owner.address, code: wrong })).status).toBe(401)
  })

  it('код входа не подходит для регистрации и наоборот', async () => {
    const owner = await registerFamily('Назначение')
    await requestCode(owner.address, 'login')
    const res = await api(app, null, 'POST', '/api/families', { consent: true, role: 'papa', name: 'Х', email: owner.address, code: await lastCode(owner.address) })
    expect(res.body).toEqual({ error: 'invalid_code' })
  })

  it('если email в нескольких семьях, предлагает выбор и не сжигает код', async () => {
    const shared = email('shared')
    const a = await registerFamily('Первая', shared)
    const b = await registerFamily('Вторая', shared)
    expect(a.body.family.code).not.toBe(b.body.family.code)

    await requestCode(shared, 'login')
    const code = await lastCode(shared)
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
    const res = await api(app, null, 'POST', '/api/auth/login', { email: shared, code: await lastCode(shared), memberId: strangerId })
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
