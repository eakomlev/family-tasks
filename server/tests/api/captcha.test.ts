import { randomBytes } from 'node:crypto'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { buildApp } from '../../src/app.js'
import { createCaptchaVerifier, type CaptchaResult, type CaptchaVerifier } from '../../src/captcha.js'
import { pool } from '../../src/db.js'
import { api } from '../helpers.js'

// Капча перед отправкой кода: сервис Яндекса подменён, настоящей сети нет.
let app: Awaited<ReturnType<typeof buildApp>>
let plain: Awaited<ReturnType<typeof buildApp>>
let result: CaptchaResult = 'ok'
const seen: { token: string; ip: string }[] = []
const suffix = randomBytes(4).toString('hex')
const domain = `captcha-${suffix}.test.local`
let n = 0
const email = () => `user${++n}@${domain}`

const verifier: CaptchaVerifier = {
  siteKey: 'site-key-1',
  async verify(token, ip) {
    seen.push({ token, ip })
    return result
  },
}

const sentTo = async (to: string) => (await pool.query(`select 1 from outbox where channel = 'email' and payload->>'to' = $1`, [to])).rowCount ?? 0
const post = (target: typeof app, body: object) => api(target, null, 'POST', '/api/email-codes', body)

beforeAll(async () => {
  app = await buildApp({ logger: false, rateLimit: false, captcha: verifier })
  plain = await buildApp({ logger: false, rateLimit: false, captcha: null })
  await app.ready()
  await plain.ready()
})
beforeEach(() => {
  result = 'ok'
  seen.length = 0
})
afterAll(async () => {
  await pool.query(`delete from outbox where channel = 'email' and payload->>'to' like $1`, [`%@${domain}`])
  await pool.query('delete from email_codes where email like $1', [`%@${domain}`])
  await app.close()
  await plain.close()
  await pool.end()
})

describe('капча перед отправкой кода', () => {
  it('ключ клиента отдаётся без входа; без капчи там null', async () => {
    expect((await api(app, null, 'GET', '/api/captcha/config')).body).toEqual({ siteKey: 'site-key-1' })
    expect((await api(plain, null, 'GET', '/api/captcha/config')).body).toEqual({ siteKey: null })
  })

  it('без токена 400 captcha_required, код не выпускается и письмо не ставится', async () => {
    const to = email()
    const res = await post(app, { email: to, purpose: 'signup' })
    expect(res.status).toBe(400)
    expect(res.body.error).toBe('captcha_required')
    expect(seen).toHaveLength(0)
    expect(await sentTo(to)).toBe(0)
  })

  it('токен не прошёл проверку: 400 captcha_failed, письма нет', async () => {
    result = 'failed'
    const to = email()
    const res = await post(app, { email: to, purpose: 'signup', captchaToken: 'bad' })
    expect(res.status).toBe(400)
    expect(res.body.error).toBe('captcha_failed')
    expect(seen).toEqual([{ token: 'bad', ip: expect.any(String) }])
    expect(await sentTo(to)).toBe(0)
  })

  it('токен прошёл: код ставится в очередь', async () => {
    const to = email()
    const res = await post(app, { email: to, purpose: 'signup', captchaToken: 'good' })
    expect(res.status).toBe(204)
    expect(await sentTo(to)).toBe(1)
  })

  it('ответ одинаков для известного и неизвестного адреса: капча проверяется раньше всего', async () => {
    result = 'failed'
    for (const purpose of ['login', 'signup'] as const) {
      const res = await post(app, { email: email(), purpose, captchaToken: 'x' })
      expect(res.body).toEqual({ error: 'captcha_failed' })
    }
  })

  it('сервис капчи не ответил: проверка пропускается, вход не ломается', async () => {
    result = 'unavailable'
    const to = email()
    expect((await post(app, { email: to, purpose: 'signup', captchaToken: 'x' })).status).toBe(204)
    expect(await sentTo(to)).toBe(1)
  })

  it('капча выключена: токен не нужен', async () => {
    const to = email()
    expect((await post(plain, { email: to, purpose: 'signup' })).status).toBe(204)
    expect(await sentTo(to)).toBe(1)
  })
})

describe('проверка токена у Яндекса', () => {
  const run = async (respond: () => Promise<Response>) => {
    const fetchMock = vi.fn(respond)
    const verdict = await createCaptchaVerifier('site', 'server-secret', fetchMock as unknown as typeof fetch).verify('tok', '1.2.3.4')
    return { verdict, fetchMock }
  }

  it('ok и failed по ответу, в запросе секрет, токен и IP', async () => {
    const ok = await run(async () => new Response(JSON.stringify({ status: 'ok', host: 'x' }), { status: 200 }))
    expect(ok.verdict).toBe('ok')
    const [url, init] = ok.fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://smartcaptcha.cloud.yandex.ru/validate')
    expect(String(init.body)).toBe('secret=server-secret&token=tok&ip=1.2.3.4')
    expect((await run(async () => new Response(JSON.stringify({ status: 'failed' }), { status: 200 }))).verdict).toBe('failed')
  })

  it('ошибка сервиса, неверный ключ (403) и сбой сети дают unavailable', async () => {
    expect((await run(async () => new Response('', { status: 403 }))).verdict).toBe('unavailable')
    expect((await run(async () => new Response('', { status: 500 }))).verdict).toBe('unavailable')
    expect((await run(async () => Promise.reject(new TypeError('network')))).verdict).toBe('unavailable')
  })
})
