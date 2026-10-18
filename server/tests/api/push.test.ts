import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { buildApp } from '../../src/app.js'
import { pool } from '../../src/db.js'
import { api, createFamily, removeFamilies, type TestFamily } from '../helpers.js'
import { sentTo } from '../webpush.js'

let app: Awaited<ReturnType<typeof buildApp>>
let fam: TestFamily

beforeAll(async () => {
  app = await buildApp({ logger: false, rateLimit: false })
  fam = await createFamily()
})
afterAll(async () => {
  await removeFamilies(fam.id)
  await app.close()
  await pool.end()
})

const keys = { p256dh: 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM', auth: 'tBHItJI5svbpez7KI4CCXg' }
const subscribe = (token: string | null, endpoint: string, timeZone = 'Europe/Moscow', k: unknown = keys) =>
  api(app, token, 'POST', '/api/push/subscriptions', { endpoint, keys: k, timeZone })
const stored = async (endpoint: string) =>
  (await pool.query('select member_id, time_zone from push_subscriptions where endpoint = $1', [endpoint])).rows

describe('настройка', () => {
  it('ключи VAPID заданы: публичный ключ отдаётся', async () => {
    const res = await api(app, null, 'GET', '/api/push/config')
    expect(res.status).toBe(200)
    expect(res.body.publicKey).toBe(process.env.VAPID_PUBLIC_KEY)
  })
})

describe('подписка: адрес принимается только у известных push-сервисов', () => {
  it('без авторизации 401', async () => {
    expect((await subscribe(null, 'https://fcm.googleapis.com/fcm/send/a')).status).toBe(401)
  })

  it.each([
    ['http вместо https', 'http://fcm.googleapis.com/fcm/send/x'],
    ['внутренний IP', 'https://127.0.0.1:8443/x'],
    ['localhost', 'https://localhost/x'],
    ['частный адрес', 'https://192.168.0.5/x'],
    ['поддельный домен', 'https://fcm.googleapis.com.evil.com/x'],
    ['совпадающий суффикс без точки', 'https://evilgoogleapis.com/x'],
    ['не адрес', 'not a url'],
    ['посторонний сервис', 'https://example.com/hook'],
  ])('отклоняет: %s', async (_name, endpoint) => {
    expect((await subscribe(fam.kid.token, endpoint)).status).toBe(400)
    expect(await stored(endpoint)).toEqual([])
  })

  it.each([
    ['Chrome (FCM)', 'https://fcm.googleapis.com/fcm/send/ok1'],
    ['Firefox', 'https://updates.push.services.mozilla.com/wpush/v2/ok2'],
    ['Safari', 'https://web.push.apple.com/ok3'],
    ['Edge', 'https://db5p.notify.windows.com/?token=ok4'],
    ['разрешённый для тестов хост', 'https://push.test/ok5'],
  ])('принимает: %s', async (_name, endpoint) => {
    expect((await subscribe(fam.kid.token, endpoint)).status).toBe(204)
    expect(await stored(endpoint)).toHaveLength(1)
  })

  it('проверяет часовой пояс и ключи', async () => {
    expect((await subscribe(fam.kid.token, 'https://push.test/tz', 'Mars/Base')).status).toBe(400)
    expect((await subscribe(fam.kid.token, 'https://push.test/nokeys', 'UTC', null)).status).toBe(400)
    expect((await subscribe(fam.kid.token, 'https://push.test/nokeys', 'UTC', { p256dh: 'x' })).status).toBe(400)
  })
})

describe('подписка и устройства', () => {
  it('повторная подписка того же адреса обновляет часовой пояс, а не дублирует', async () => {
    const endpoint = 'https://push.test/device-1'
    await subscribe(fam.kid.token, endpoint, 'Europe/Moscow')
    await subscribe(fam.kid.token, endpoint, 'Asia/Tokyo')
    expect(await stored(endpoint)).toEqual([{ member_id: fam.kid.id, time_zone: 'Asia/Tokyo' }])
  })

  it('если на устройстве вошёл другой участник, подписка переходит к нему', async () => {
    const endpoint = 'https://push.test/device-2'
    await subscribe(fam.kid.token, endpoint)
    await subscribe(fam.mom.token, endpoint)
    expect(await stored(endpoint)).toEqual([{ member_id: fam.mom.id, time_zone: 'Europe/Moscow' }])
  })

  it('отписаться можно только от своей подписки', async () => {
    const endpoint = 'https://push.test/device-3'
    await subscribe(fam.kid.token, endpoint)
    await api(app, fam.mom.token, 'POST', '/api/push/unsubscribe', { endpoint })
    expect(await stored(endpoint)).toHaveLength(1)
    expect((await api(app, fam.kid.token, 'POST', '/api/push/unsubscribe', { endpoint })).status).toBe(204)
    expect(await stored(endpoint)).toEqual([])
    expect((await api(app, null, 'POST', '/api/push/unsubscribe', { endpoint })).status).toBe(401)
  })
})

describe('проверочное уведомление', () => {
  it('без подписок 404', async () => {
    expect((await api(app, fam.sis.token, 'POST', '/api/push/test')).body).toEqual({ error: 'no_subscriptions' })
  })

  it('ставит по сообщению на каждое устройство участника; sent и failed оставлены для клиента прежней версии', async () => {
    const a = 'https://push.test/dad-a'
    const b = 'https://push.test/dad-b'
    await subscribe(fam.dad.token, a)
    await subscribe(fam.dad.token, b)
    const res = await api(app, fam.dad.token, 'POST', '/api/push/test')

    expect(res.body).toEqual({ queued: 2, sent: 2, failed: 0 })
    const queued = await sentTo([a, b])
    expect(queued).toHaveLength(2)
    expect(queued[0].payload).toMatchObject({ title: 'Проверка уведомлений', url: '/profile/notifications', tag: 'test' })
  })
})

// ---- устройства с приложением (токен Firebase) ----

const TOKEN = 'fcm-token-'.padEnd(40, 'x')
const device = (token: string | null, deviceToken = TOKEN, timeZone = 'Europe/Moscow') => api(app, token, 'POST', '/api/push/devices', { token: deviceToken, timeZone })
const storedDevice = async (token: string) =>
  (await pool.query('select member_id, time_zone, kind, p256dh, auth from push_subscriptions where endpoint = $1', [token])).rows

describe('устройство с приложением', () => {
  it('без авторизации 401', async () => {
    expect((await device(null)).status).toBe(401)
  })

  it('регистрирует токен: вид fcm, ключей нет', async () => {
    const token = `${TOKEN}-1`
    expect((await device(fam.kid.token, token)).status).toBe(204)
    expect(await storedDevice(token)).toEqual([{ member_id: fam.kid.id, time_zone: 'Europe/Moscow', kind: 'fcm', p256dh: null, auth: null }])
  })

  it('повтор обновляет часовой пояс, а не дублирует; токен переходит к тому, кто вошёл на устройстве последним', async () => {
    const token = `${TOKEN}-2`
    await device(fam.kid.token, token, 'Europe/Moscow')
    await device(fam.kid.token, token, 'Asia/Tokyo')
    expect(await storedDevice(token)).toMatchObject([{ member_id: fam.kid.id, time_zone: 'Asia/Tokyo' }])
    await device(fam.mom.token, token)
    expect(await storedDevice(token)).toMatchObject([{ member_id: fam.mom.id, kind: 'fcm' }])
  })

  it('проверяет часовой пояс и длину токена', async () => {
    expect((await device(fam.kid.token, `${TOKEN}-3`, 'Mars/Base')).status).toBe(400)
    expect((await device(fam.kid.token, 'short')).status).toBe(400)
  })

  it('отписаться от токена можно только от своего', async () => {
    const token = `${TOKEN}-4`
    await device(fam.kid.token, token)
    await api(app, fam.mom.token, 'POST', '/api/push/unsubscribe', { endpoint: token })
    expect(await storedDevice(token)).toHaveLength(1)
    expect((await api(app, fam.kid.token, 'POST', '/api/push/unsubscribe', { endpoint: token })).status).toBe(204)
    expect(await storedDevice(token)).toEqual([])
  })

  it('проверочное уведомление ставится и на устройство с приложением', async () => {
    const token = `${TOKEN}-5`
    await device(fam.sis.token, token)
    const res = await api(app, fam.sis.token, 'POST', '/api/push/test')
    expect(res.body).toMatchObject({ queued: 1 })
    expect(await sentTo([token])).toHaveLength(1)
  })
})
