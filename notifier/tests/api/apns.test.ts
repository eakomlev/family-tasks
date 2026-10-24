import { createPublicKey, createVerify, generateKeyPairSync } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import {
  buildApnsPayload,
  collapseId,
  createApnsProvider,
  createApnsSender,
  parseApnsConfig,
  signProviderToken,
  type ApnsConfig,
  type ApnsSend,
  type ApnsTransport,
} from '../../src/providers/apns.js'
import { createPushRouter } from '../../src/providers/pushRouter.js'
import { createMember, pool, removeFamily, subscribe } from '../helpers.js'

const message = { title: 'Заголовок', body: 'Текст', url: '/chat/family', tag: 'chat-family' }
const payload = (subscriptionId: string) => ({ v: 1 as const, subscriptionId, message })
const exists = async (id: string) => (await pool.query('select 1 from push_subscriptions where id = $1', [id])).rowCount === 1
const DEVICE = 'a'.repeat(64)

const { privateKey, publicKey } = generateKeyPairSync('ec', {
  namedCurve: 'P-256',
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  publicKeyEncoding: { type: 'spki', format: 'pem' },
})
const config: ApnsConfig = { keyPem: privateKey, keyId: 'ABC123DEFG', teamId: 'TEAM123456', topic: 'ru.familytasks.mobile', production: true }

let familyId: string
let memberId: string
beforeAll(async () => {
  ;({ familyId, memberId } = await createMember())
})
afterAll(async () => {
  await removeFamily(familyId)
  await pool.end()
})

// подписка-устройство iPhone с токеном APNs
async function subscribeIphone(token = DEVICE) {
  const { rows } = await pool.query(
    `insert into push_subscriptions (member_id, endpoint, p256dh, auth, time_zone, kind) values ($1, $2, null, null, 'UTC', 'apns') returning id`,
    [memberId, token],
  )
  return { id: rows[0].id as string, endpoint: token }
}

describe('настройки APNs', () => {
  it('ключ, идентификатор ключа, команда и bundle id берутся из окружения', () => {
    const env = { APNS_KEY_BASE64: Buffer.from(privateKey).toString('base64'), APNS_KEY_ID: 'K', APNS_TEAM_ID: 'T', APNS_BUNDLE_ID: 'b.id' }
    expect(parseApnsConfig(env)).toEqual({ keyPem: privateKey, keyId: 'K', teamId: 'T', topic: 'b.id', production: true })
    expect(parseApnsConfig({ ...env, APNS_PRODUCTION: 'false' })?.production).toBe(false)
  })

  it('чего-то нет или ключ не похож на ключ: null', () => {
    expect(parseApnsConfig({})).toBeNull()
    expect(parseApnsConfig({ APNS_KEY_BASE64: Buffer.from('не ключ').toString('base64'), APNS_KEY_ID: 'K', APNS_TEAM_ID: 'T', APNS_BUNDLE_ID: 'b' })).toBeNull()
  })
})

describe('токен провайдера и сообщение', () => {
  it('JWT подписан ES256 ключом аккаунта и содержит команду и время', () => {
    const jwt = signProviderToken(config, 1_000_000)
    const [header, claim, signature] = jwt.split('.')
    expect(JSON.parse(Buffer.from(header, 'base64url').toString())).toEqual({ alg: 'ES256', kid: 'ABC123DEFG' })
    expect(JSON.parse(Buffer.from(claim, 'base64url').toString())).toEqual({ iss: 'TEAM123456', iat: 1_000_000 })
    const verify = createVerify('SHA256').update(`${header}.${claim}`)
    expect(verify.verify({ key: createPublicKey(publicKey), dsaEncoding: 'ieee-p1363' }, Buffer.from(signature, 'base64url'))).toBe(true)
  })

  it('уведомление показывает система, адрес и tag идут отдельными ключами', () => {
    expect(buildApnsPayload(message)).toEqual({ aps: { alert: { title: 'Заголовок', body: 'Текст' }, sound: 'default' }, url: '/chat/family', tag: 'chat-family' })
  })

  it('идентификатор склейки не длиннее 64 байт', () => {
    expect(collapseId('chat-family')).toBe('chat-family')
    const long = `training:18:30:${'Хоккей '.repeat(10)}`
    expect(Buffer.from(collapseId(long)).length).toBeLessThanOrEqual(64)
  })
})

// подмена сети: возвращает заготовленные ответы по очереди
function fakeTransport(responses: { status: number; body?: string; retryAfter?: string }[]) {
  const calls: Parameters<ApnsTransport>[0][] = []
  let i = 0
  const fn: ApnsTransport = vi.fn(async (request) => {
    calls.push(request)
    const res = responses[Math.min(i++, responses.length - 1)]
    return { status: res.status, body: res.body ?? '', retryAfter: res.retryAfter }
  })
  return { fn, calls }
}

describe('отправка в APNs', () => {
  it('заголовки: тема, тип, приоритет, срок, склейка; токен провайдера переиспользуется', async () => {
    const { fn, calls } = fakeTransport([{ status: 200 }])
    const send = createApnsSender(config, fn, () => 1_000_000_000)
    await send(DEVICE, message)
    await send(DEVICE, message)
    expect(calls).toHaveLength(2)
    expect(calls[0].deviceToken).toBe(DEVICE)
    expect(calls[0].headers).toMatchObject({
      'apns-topic': 'ru.familytasks.mobile',
      'apns-push-type': 'alert',
      'apns-priority': '10',
      'apns-collapse-id': 'chat-family',
      'apns-expiration': String(1_000_000 + 6 * 3600),
    })
    expect(calls[0].headers.authorization).toBe(calls[1].headers.authorization)
    expect(JSON.parse(calls[0].body)).toEqual(buildApnsPayload(message))
  })

  it('токен провайдера обновляется через 40 минут', async () => {
    const { fn, calls } = fakeTransport([{ status: 200 }])
    let now = 1_000_000_000
    const send = createApnsSender(config, fn, () => now)
    await send(DEVICE, message)
    now += 41 * 60 * 1000
    await send(DEVICE, message)
    expect(calls[0].headers.authorization).not.toBe(calls[1].headers.authorization)
  })

  it('ExpiredProviderToken: токен выпускается заново и запрос повторяется один раз', async () => {
    const { fn, calls } = fakeTransport([{ status: 403, body: '{"reason":"ExpiredProviderToken"}' }, { status: 200 }])
    let now = 1_000_000_000
    const send = createApnsSender(config, fn, () => (now += 1000))
    const res = await send(DEVICE, message)
    expect(res.status).toBe(200)
    expect(calls).toHaveLength(2)
  })

  it('причина отказа берётся из ответа; токен не из шестнадцатеричных знаков в запрос не попадает', async () => {
    const { fn } = fakeTransport([{ status: 410, body: '{"reason":"Unregistered"}' }])
    expect(await createApnsSender(config, fn)(DEVICE, message)).toMatchObject({ status: 410, reason: 'Unregistered' })
    const never = fakeTransport([{ status: 200 }])
    expect(await createApnsSender(config, never.fn)('../../evil', message)).toEqual({ status: 400, reason: 'BadDeviceToken' })
    expect(never.fn).not.toHaveBeenCalled()
  })
})

describe('провайдер очереди для iPhone', () => {
  const provider = (send: ApnsSend, enabled = true) => createApnsProvider(pool, send, enabled)
  const ok: ApnsSend = async () => ({ status: 200 })

  it('шлёт сообщение на токен устройства', async () => {
    const sub = await subscribeIphone('b'.repeat(64))
    const send = vi.fn(ok)
    expect(await provider(send)(payload(sub.id))).toEqual({ kind: 'sent' })
    expect(send).toHaveBeenCalledWith(sub.endpoint, message)
  })

  it('ключ APNs не задан: постоянная ошибка, сеть не трогаем', async () => {
    const sub = await subscribeIphone('c'.repeat(64))
    const send = vi.fn(ok)
    expect(await provider(send, false)(payload(sub.id))).toEqual({ kind: 'fail', error: 'apns_not_configured' })
    expect(send).not.toHaveBeenCalled()
  })

  it('подписки нет: пропуск', async () => {
    expect(await provider(ok)(payload('00000000-0000-4000-8000-000000000000'))).toEqual({ kind: 'skip', reason: 'subscription_gone' })
  })

  it.each([
    ['410', { status: 410 }],
    ['Unregistered', { status: 400, reason: 'Unregistered' }],
    ['BadDeviceToken', { status: 400, reason: 'BadDeviceToken' }],
    ['чужое приложение', { status: 400, reason: 'DeviceTokenNotForTopic' }],
  ])('устройство больше не существует (%s): подписка удаляется, строка снимается без шума', async (_name, response) => {
    const sub = await subscribeIphone('d'.repeat(64))
    expect(await provider(async () => response)(payload(sub.id))).toEqual({ kind: 'skip', reason: 'subscription_gone' })
    expect(await exists(sub.id)).toBe(false)
  })

  it.each([400, 403, 413])('%i без признака удаления: постоянная ошибка, подписка остаётся', async (status) => {
    const sub = await subscribeIphone(String(status).padEnd(64, '9'))
    expect(await provider(async () => ({ status, reason: 'InvalidProviderToken' }))(payload(sub.id))).toEqual({ kind: 'fail', error: `${status} InvalidProviderToken` })
    expect(await exists(sub.id)).toBe(true)
  })

  it('429 и 5xx: повторить позже, Retry-After учитывается; сбой сети тоже временный', async () => {
    const sub = await subscribeIphone('f'.repeat(64))
    expect(await provider(async () => ({ status: 429, reason: 'TooManyRequests', retryAfter: '30' }))(payload(sub.id))).toEqual({
      kind: 'retry',
      error: '429 TooManyRequests',
      retryAfterSeconds: 30,
    })
    expect((await provider(async () => ({ status: 503 }))(payload(sub.id))).kind).toBe('retry')
    const net = await provider(async () => {
      throw new Error('ECONNRESET')
    })(payload(sub.id))
    expect(net).toMatchObject({ kind: 'retry' })
  })
})

describe('выбор провайдера по виду подписки', () => {
  it('iPhone идёт в APNs, браузер в Web Push', async () => {
    const web = vi.fn(async () => ({ kind: 'sent' as const }))
    const fcm = vi.fn(async () => ({ kind: 'sent' as const }))
    const apns = vi.fn(async () => ({ kind: 'sent' as const }))
    const route = createPushRouter(pool, { web, fcm, apns })

    const iphone = await subscribeIphone('1'.repeat(64))
    const browser = await subscribe(memberId)
    await route(payload(iphone.id))
    expect([web.mock.calls.length, fcm.mock.calls.length, apns.mock.calls.length]).toEqual([0, 0, 1])
    await route(payload(browser.id))
    expect([web.mock.calls.length, fcm.mock.calls.length, apns.mock.calls.length]).toEqual([1, 0, 1])
  })
})
