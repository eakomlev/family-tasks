import { createPublicKey, createVerify, generateKeyPairSync } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { buildFcmMessage, createFcmProvider, createFcmSender, parseServiceAccount, signJwt, type FcmSend } from '../../src/providers/fcm.js'
import { createPushRouter } from '../../src/providers/pushRouter.js'
import { createMember, pool, removeFamily, subscribe, subscribeDevice } from '../helpers.js'

const message = { title: 'Заголовок', body: 'Текст', url: '/chat/family', tag: 'chat-family' }
const payload = (subscriptionId: string) => ({ v: 1 as const, subscriptionId, message })
const exists = async (id: string) => (await pool.query('select 1 from push_subscriptions where id = $1', [id])).rowCount === 1

const { privateKey, publicKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  publicKeyEncoding: { type: 'spki', format: 'pem' },
})
const account = { project_id: 'family-tasks-test', client_email: 'push@family-tasks-test.iam.gserviceaccount.com', private_key: privateKey }

let familyId: string
let memberId: string
beforeAll(async () => {
  ;({ familyId, memberId } = await createMember())
})
afterAll(async () => {
  await removeFamily(familyId)
  await pool.end()
})

describe('ключ сервисного аккаунта', () => {
  it('разбирается из base64, лишнее отбрасывается', () => {
    const encoded = Buffer.from(JSON.stringify({ ...account, type: 'service_account', private_key_id: 'x' })).toString('base64')
    expect(parseServiceAccount(encoded)).toEqual({ ...account, token_uri: undefined })
  })

  it('нет ключа, не base64 или неполный JSON: null', () => {
    expect(parseServiceAccount(undefined)).toBeNull()
    expect(parseServiceAccount('')).toBeNull()
    expect(parseServiceAccount('не base64 и не json')).toBeNull()
    expect(parseServiceAccount(Buffer.from('{"project_id":"x"}').toString('base64'))).toBeNull()
  })

  it('утверждение подписано ключом аккаунта и содержит нужные поля', () => {
    const jwt = signJwt(account, 1_000_000)
    const [header, claim, signature] = jwt.split('.')
    expect(JSON.parse(Buffer.from(header, 'base64url').toString())).toEqual({ alg: 'RS256', typ: 'JWT' })
    expect(JSON.parse(Buffer.from(claim, 'base64url').toString())).toEqual({
      iss: account.client_email,
      scope: 'https://www.googleapis.com/auth/firebase.messaging',
      aud: 'https://oauth2.googleapis.com/token',
      iat: 1_000_000,
      exp: 1_003_600,
    })
    const verify = createVerify('RSA-SHA256').update(`${header}.${claim}`)
    expect(verify.verify(createPublicKey(publicKey), Buffer.from(signature, 'base64url'))).toBe(true)
  })
})

describe('сообщение FCM', () => {
  it('уведомление, данные для перехода, склейка по tag и срок жизни 6 часов', () => {
    expect(buildFcmMessage('tok', message)).toEqual({
      message: {
        token: 'tok',
        notification: { title: 'Заголовок', body: 'Текст' },
        data: { url: '/chat/family', tag: 'chat-family' },
        android: { priority: 'HIGH', ttl: '21600s', collapse_key: 'chat-family', notification: { tag: 'chat-family', channel_id: 'default' } },
      },
    })
  })
})

// подмена сети: первый запрос обмен на токен доступа, дальше отправка
function fakeFetch(sendStatuses: number[], sendBody = '{}') {
  const calls: { url: string; headers: Record<string, string>; body: string }[] = []
  let sends = 0
  const fn = vi.fn(async (url: string, init: { method: string; headers: Record<string, string>; body: string }) => {
    calls.push({ url, headers: init.headers, body: init.body })
    if (url.includes('oauth2.googleapis.com')) {
      return { status: 200, headers: { get: () => null }, text: async () => JSON.stringify({ access_token: `access-${calls.length}`, expires_in: 3600 }) }
    }
    const status = sendStatuses[Math.min(sends++, sendStatuses.length - 1)]
    return { status, headers: { get: (name: string) => (name === 'retry-after' ? '30' : null) }, text: async () => (status === 200 ? '{}' : sendBody) }
  })
  return { fn, calls }
}

describe('отправка в FCM', () => {
  it('токен доступа берётся один раз и используется повторно', async () => {
    const { fn, calls } = fakeFetch([200, 200])
    const send = createFcmSender(account, fn, () => 1_000_000_000)
    await send('device-token', message)
    await send('device-token', message)
    expect(calls.filter((c) => c.url.includes('oauth2')).length).toBe(1)
    const sends = calls.filter((c) => c.url.includes('fcm.googleapis.com'))
    expect(sends).toHaveLength(2)
    expect(sends[0].url).toBe('https://fcm.googleapis.com/v1/projects/family-tasks-test/messages:send')
    expect(sends[0].headers.authorization).toBe('Bearer access-1')
    expect(JSON.parse(sends[0].body).message.token).toBe('device-token')
  })

  it('токен доступа истёк (прошло больше часа): запрашивается заново', async () => {
    const { fn, calls } = fakeFetch([200, 200])
    let now = 1_000_000_000
    const send = createFcmSender(account, fn, () => now)
    await send('t', message)
    now += 3600 * 1000
    await send('t', message)
    expect(calls.filter((c) => c.url.includes('oauth2')).length).toBe(2)
  })

  it('401 от FCM: токен доступа обновляется и запрос повторяется один раз', async () => {
    const { fn, calls } = fakeFetch([401, 200])
    const res = await createFcmSender(account, fn, () => 1_000_000_000)('t', message)
    expect(res.status).toBe(200)
    expect(calls.filter((c) => c.url.includes('oauth2')).length).toBe(2)
  })

  it('код ошибки берётся из ответа FCM', async () => {
    const body = JSON.stringify({ error: { status: 'NOT_FOUND', details: [{ errorCode: 'UNREGISTERED' }] } })
    const res = await createFcmSender(account, fakeFetch([404], body).fn, () => 1_000_000_000)('t', message)
    expect(res).toMatchObject({ status: 404, errorCode: 'UNREGISTERED' })
  })

  it('не получилось обменять ключ на токен доступа: ошибка, а не отправка', async () => {
    const fn = vi.fn(async () => ({ status: 400, headers: { get: () => null }, text: async () => '{"error":"invalid_grant"}' }))
    await expect(createFcmSender(account, fn, () => 1)('t', message)).rejects.toThrow(/fcm_auth_failed/)
  })
})

describe('провайдер очереди для устройств', () => {
  const provider = (send: FcmSend, enabled = true) => createFcmProvider(pool, send, enabled)
  const ok: FcmSend = async () => ({ status: 200 })

  it('шлёт сообщение на токен устройства', async () => {
    const sub = await subscribeDevice(memberId)
    const send = vi.fn(ok)
    expect(await provider(send)(payload(sub.id))).toEqual({ kind: 'sent' })
    expect(send).toHaveBeenCalledWith(sub.endpoint, message)
  })

  it('ключ сервисного аккаунта не задан: постоянная ошибка, сеть не трогаем', async () => {
    const sub = await subscribeDevice(memberId)
    const send = vi.fn(ok)
    expect(await provider(send, false)(payload(sub.id))).toEqual({ kind: 'fail', error: 'fcm_not_configured' })
    expect(send).not.toHaveBeenCalled()
  })

  it('подписки нет: пропуск', async () => {
    expect(await provider(ok)(payload('00000000-0000-4000-8000-000000000000'))).toEqual({ kind: 'skip', reason: 'subscription_gone' })
  })

  it.each([
    ['404', { status: 404 }],
    ['UNREGISTERED', { status: 400, errorCode: 'UNREGISTERED' }],
    ['чужой проект', { status: 403, errorCode: 'SENDER_ID_MISMATCH' }],
  ])('устройство больше не существует (%s): подписка удаляется, строка снимается без шума', async (_name, response) => {
    const sub = await subscribeDevice(memberId)
    expect(await provider(async () => response)(payload(sub.id))).toEqual({ kind: 'skip', reason: 'subscription_gone' })
    expect(await exists(sub.id)).toBe(false)
  })

  it.each([400, 401, 403])('%i без признака удаления: постоянная ошибка, подписка остаётся', async (status) => {
    const sub = await subscribeDevice(memberId)
    expect(await provider(async () => ({ status, errorCode: 'INVALID_ARGUMENT' }))(payload(sub.id))).toEqual({ kind: 'fail', error: `${status} INVALID_ARGUMENT` })
    expect(await exists(sub.id)).toBe(true)
  })

  it('429 и 5xx: повторить позже, Retry-After учитывается', async () => {
    const sub = await subscribeDevice(memberId)
    expect(await provider(async () => ({ status: 429, errorCode: 'QUOTA_EXCEEDED', retryAfter: '30' }))(payload(sub.id))).toEqual({
      kind: 'retry',
      error: '429 QUOTA_EXCEEDED',
      retryAfterSeconds: 30,
    })
    expect((await provider(async () => ({ status: 503 }))(payload(sub.id))).kind).toBe('retry')
  })

  it('сбой сети: повторить позже', async () => {
    const sub = await subscribeDevice(memberId)
    const result = await provider(async () => {
      throw new Error('ECONNRESET')
    })(payload(sub.id))
    expect(result).toMatchObject({ kind: 'retry' })
  })
})

describe('выбор провайдера по виду подписки', () => {
  it('браузерная подписка идёт в Web Push, устройство в FCM, удалённая пропускается', async () => {
    const web = vi.fn(async () => ({ kind: 'sent' as const }))
    const fcm = vi.fn(async () => ({ kind: 'sent' as const }))
    const route = createPushRouter(pool, { web, fcm })

    const browser = await subscribe(memberId)
    const device = await subscribeDevice(memberId)
    await route(payload(browser.id))
    expect([web.mock.calls.length, fcm.mock.calls.length]).toEqual([1, 0])
    await route(payload(device.id))
    expect([web.mock.calls.length, fcm.mock.calls.length]).toEqual([1, 1])
    expect(await route(payload('00000000-0000-4000-8000-000000000000'))).toEqual({ kind: 'skip', reason: 'subscription_gone' })
  })
})
