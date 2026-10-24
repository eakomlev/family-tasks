import { createSign } from 'node:crypto'
import { connect, type ClientHttp2Session } from 'node:http2'
import type { PushMessage, PushPayload } from '../contract.js'
import type { Db } from '../db.js'
import type { Outcome } from '../outcome.js'
import { parseRetryAfter } from '../retry.js'

// Push на iPhone напрямую через Apple Push Notification service (HTTP/2). Токен провайдера (JWT, ES256) подписывается ключом .p8 из
// Apple Developer средствами node:crypto, соединение с APNs держится одно на всё время работы. Сеть подменяется функцией transport для тестов.

// Если устройство долго недоступно, уведомление уже не нужно (как у Web Push и FCM)
const TTL_SECONDS = 6 * 60 * 60
// APNs просит обновлять токен провайдера не чаще раза в 20 минут и не реже раза в час
const TOKEN_REFRESH_SECONDS = 40 * 60
const REQUEST_TIMEOUT_MS = 15_000
// идентификатор склейки не длиннее 64 байт
const COLLAPSE_ID_MAX = 64

export interface ApnsConfig {
  // закрытый ключ .p8 (PEM)
  keyPem: string
  keyId: string
  teamId: string
  // идентификатор приложения (bundle id), он же apns-topic
  topic: string
  // true: боевой APNs (сборки TestFlight и App Store), false: песочница (сборки из Xcode)
  production: boolean
}

// Настройки приходят из окружения: ключ .p8 одной строкой base64 (многострочное значение в .env ломает разбор). Чего-то нет: null.
export function parseApnsConfig(env: Record<string, string | undefined>): ApnsConfig | null {
  const { APNS_KEY_BASE64: key, APNS_KEY_ID: keyId, APNS_TEAM_ID: teamId, APNS_BUNDLE_ID: topic } = env
  if (!key || !keyId || !teamId || !topic) return null
  const keyPem = Buffer.from(key, 'base64').toString('utf8')
  if (!keyPem.includes('PRIVATE KEY')) return null
  return { keyPem, keyId, teamId, topic, production: env.APNS_PRODUCTION !== 'false' }
}

const b64url = (input: string | Buffer) => Buffer.from(input).toString('base64url')

// Токен провайдера: JWT, подписанный ES256 (подпись в формате r||s, как требует JWT)
export function signProviderToken(config: ApnsConfig, nowSeconds: number): string {
  const header = b64url(JSON.stringify({ alg: 'ES256', kid: config.keyId }))
  const claim = b64url(JSON.stringify({ iss: config.teamId, iat: nowSeconds }))
  const signature = createSign('SHA256').update(`${header}.${claim}`).sign({ key: config.keyPem, dsaEncoding: 'ieee-p1363' })
  return `${header}.${claim}.${b64url(signature)}`
}

// Тело уведомления: показывает система, даже когда приложение закрыто; `url` и `tag` уходят отдельными ключами (по ним приложение
// открывает нужный экран)
export function buildApnsPayload(message: PushMessage) {
  return { aps: { alert: { title: message.title, body: message.body }, sound: 'default' }, url: message.url, tag: message.tag }
}

// tag склеивает уведомления одного чата (новое заменяет прежнее); у APNs идентификатор не длиннее 64 байт
export function collapseId(tag: string): string {
  const bytes = Buffer.from(tag)
  return bytes.length <= COLLAPSE_ID_MAX ? tag : bytes.subarray(0, COLLAPSE_ID_MAX).toString('utf8').replace(/�+$/, '')
}

export interface ApnsRequest {
  deviceToken: string
  headers: Record<string, string>
  body: string
}

export interface ApnsTransportResponse {
  status: number
  body: string
  retryAfter?: string
}

export type ApnsTransport = (request: ApnsRequest) => Promise<ApnsTransportResponse>

export interface ApnsResponse {
  status: number
  // причина отказа из ответа APNs (BadDeviceToken, Unregistered, …) или пусто
  reason?: string
  retryAfter?: string
}

// Отправляет одно сообщение; бросает только при сбое сети
export type ApnsSend = (deviceToken: string, message: PushMessage) => Promise<ApnsResponse>

// Токен устройства APNs это шестнадцатеричная строка; другое в адрес запроса не подставляем
const DEVICE_TOKEN = /^[0-9a-f]{32,200}$/i

function reasonOf(body: string): string | undefined {
  try {
    return (JSON.parse(body) as { reason?: string }).reason
  } catch {
    return undefined
  }
}

// Настоящая отправка: токен провайдера кэшируется на 40 минут и обновляется, если APNs сказал, что он истёк
export function createApnsSender(config: ApnsConfig, transport: ApnsTransport, now: () => number = Date.now): ApnsSend {
  let cached: { token: string; issuedAt: number } | undefined

  function providerToken(force = false): string {
    if (!force && cached && now() - cached.issuedAt < TOKEN_REFRESH_SECONDS * 1000) return cached.token
    cached = { token: signProviderToken(config, Math.floor(now() / 1000)), issuedAt: now() }
    return cached.token
  }

  async function post(deviceToken: string, message: PushMessage, bearer: string) {
    return transport({
      deviceToken,
      headers: {
        authorization: `bearer ${bearer}`,
        'apns-topic': config.topic,
        'apns-push-type': 'alert',
        'apns-priority': '10',
        'apns-expiration': String(Math.floor(now() / 1000) + TTL_SECONDS),
        'apns-collapse-id': collapseId(message.tag),
        'content-type': 'application/json',
      },
      body: JSON.stringify(buildApnsPayload(message)),
    })
  }

  return async (deviceToken, message) => {
    if (!DEVICE_TOKEN.test(deviceToken)) return { status: 400, reason: 'BadDeviceToken' }
    let res = await post(deviceToken, message, providerToken())
    // токен провайдера мог истечь раньше срока: берём новый и повторяем один раз
    if (res.status === 403 && reasonOf(res.body) === 'ExpiredProviderToken') res = await post(deviceToken, message, providerToken(true))
    return { status: res.status, reason: res.status === 200 ? undefined : reasonOf(res.body), retryAfter: res.retryAfter }
  }
}

// Настоящее соединение с APNs по HTTP/2: одно на процесс, открывается при первой отправке и переоткрывается после обрыва
export function createHttp2Transport(production: boolean): ApnsTransport {
  const origin = production ? 'https://api.push.apple.com' : 'https://api.sandbox.push.apple.com'
  let session: ClientHttp2Session | undefined

  function current(): ClientHttp2Session {
    if (session && !session.closed && !session.destroyed) return session
    const next = connect(origin)
    // пока запросов нет, соединение не должно держать процесс
    next.unref()
    next.on('error', () => {
      if (session === next) session = undefined
    })
    next.on('close', () => {
      if (session === next) session = undefined
    })
    session = next
    return next
  }

  return ({ deviceToken, headers, body }) =>
    new Promise((resolve, reject) => {
      const stream = current().request({ ':method': 'POST', ':path': `/3/device/${deviceToken}`, ...headers })
      let status = 0
      let retryAfter: string | undefined
      let data = ''
      stream.setEncoding('utf8')
      stream.setTimeout(REQUEST_TIMEOUT_MS, () => {
        stream.close()
        reject(new Error('apns_timeout'))
      })
      stream.on('response', (responseHeaders) => {
        status = Number(responseHeaders[':status'])
        const value = responseHeaders['retry-after']
        retryAfter = Array.isArray(value) ? value[0] : value
      })
      stream.on('data', (chunk: string) => {
        data += chunk
      })
      stream.on('end', () => resolve({ status, body: data, retryAfter }))
      stream.on('error', reject)
      stream.end(body)
    })
}

// Провайдер очереди для подписок вида apns; ошибки классифицируются как у Web Push и FCM: постоянные (повторять бессмысленно),
// временные (повторить позже) и «устройство больше не существует» (подписку удаляем, строку снимаем без шума).
export function createApnsProvider(db: Db, send: ApnsSend, enabled: boolean) {
  return async (payload: PushPayload): Promise<Outcome> => {
    if (!enabled) return { kind: 'fail', error: 'apns_not_configured' }

    const { rows } = await db.query<{ endpoint: string }>('select endpoint from push_subscriptions where id = $1', [payload.subscriptionId])
    const sub = rows[0]
    // подписку успели удалить
    if (!sub) return { kind: 'skip', reason: 'subscription_gone' }

    let res: ApnsResponse
    try {
      res = await send(sub.endpoint, payload.message)
    } catch (err) {
      // сеть, обрыв соединения или таймаут: временная ошибка
      return { kind: 'retry', error: `network ${(err as Error).message}`.trim() }
    }
    if (res.status === 200) return { kind: 'sent' }

    // приложение удалено, токен устарел или выдан для другого приложения: шлём впустую, подписку убираем
    if (res.status === 410 || res.reason === 'Unregistered' || res.reason === 'BadDeviceToken' || res.reason === 'DeviceTokenNotForTopic') {
      await db.query('delete from push_subscriptions where id = $1', [payload.subscriptionId])
      return { kind: 'skip', reason: 'subscription_gone' }
    }
    const error = `${res.status} ${res.reason ?? ''}`.trim()
    // ключ, топик или запрос настроены неверно (403, 400, 413): повтор не поможет
    if (res.status === 400 || res.status === 403 || res.status === 413) return { kind: 'fail', error }
    // 429, 5xx: временно; Retry-After удлиняет паузу
    return { kind: 'retry', error, retryAfterSeconds: parseRetryAfter(res.retryAfter) }
  }
}

// Реальный провайдер из окружения; без ключа APNs push на iPhone выключен
export function apnsProviderFromEnv(db: Db, env: Record<string, string | undefined> = process.env) {
  const config = parseApnsConfig(env)
  const send: ApnsSend = config ? createApnsSender(config, createHttp2Transport(config.production)) : async () => ({ status: 0 })
  return { provider: createApnsProvider(db, send, config !== null), enabled: config !== null }
}
