import { createSign } from 'node:crypto'
import type { PushMessage, PushPayload } from '../contract.js'
import type { Db } from '../db.js'
import type { Outcome } from '../outcome.js'
import { parseRetryAfter } from '../retry.js'

// Push на Android через Firebase Cloud Messaging (HTTP v1). Токен доступа получаем по ключу сервисного аккаунта сами (JWT, подписанный
// RS256 средствами node:crypto): отдельная библиотека ради одного запроса не нужна. Сеть подменяется функцией fetch для тестов.

// Если устройство долго недоступно, уведомление уже не нужно (как у Web Push)
const TTL_SECONDS = 6 * 60 * 60
const SCOPE = 'https://www.googleapis.com/auth/firebase.messaging'
const DEFAULT_TOKEN_URI = 'https://oauth2.googleapis.com/token'
// токен доступа живёт час; обновляем с запасом
const TOKEN_LIFETIME_SECONDS = 3600
const TOKEN_REFRESH_MARGIN_SECONDS = 300

export interface ServiceAccount {
  project_id: string
  client_email: string
  private_key: string
  token_uri?: string
}

// Ключ сервисного аккаунта приходит из окружения одной строкой base64 (многострочный JSON в .env ломает разбор). Нет ключа или он испорчен: null.
export function parseServiceAccount(base64: string | undefined): ServiceAccount | null {
  if (!base64) return null
  try {
    const parsed = JSON.parse(Buffer.from(base64, 'base64').toString('utf8')) as Partial<ServiceAccount>
    if (!parsed.project_id || !parsed.client_email || !parsed.private_key) return null
    return { project_id: parsed.project_id, client_email: parsed.client_email, private_key: parsed.private_key, token_uri: parsed.token_uri }
  } catch {
    return null
  }
}

const b64url = (input: string | Buffer) => Buffer.from(input).toString('base64url')

// Подписанное утверждение для обмена на токен доступа
export function signJwt(account: ServiceAccount, nowSeconds: number): string {
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const claim = b64url(
    JSON.stringify({
      iss: account.client_email,
      scope: SCOPE,
      aud: account.token_uri ?? DEFAULT_TOKEN_URI,
      iat: nowSeconds,
      exp: nowSeconds + TOKEN_LIFETIME_SECONDS,
    }),
  )
  const signature = createSign('RSA-SHA256').update(`${header}.${claim}`).sign(account.private_key)
  return `${header}.${claim}.${b64url(signature)}`
}

type Fetch = (url: string, init: { method: string; headers: Record<string, string>; body: string }) => Promise<{
  status: number
  headers: { get(name: string): string | null }
  text(): Promise<string>
}>

export interface FcmResponse {
  status: number
  // код ошибки FCM из ответа (UNREGISTERED, INVALID_ARGUMENT, …) или пусто
  errorCode?: string
  retryAfter?: string | null
}

// Отправляет одно сообщение; бросает только при сбое сети
export type FcmSend = (token: string, message: PushMessage) => Promise<FcmResponse>

// Сообщение FCM: уведомление показывает система, даже когда приложение закрыто; `url` и `tag` уходят в данные (по ним приложение открывает
// нужный экран), а tag ещё и склеивает уведомления одного чата (новое заменяет прежнее).
export function buildFcmMessage(token: string, message: PushMessage) {
  return {
    message: {
      token,
      notification: { title: message.title, body: message.body },
      data: { url: message.url, tag: message.tag },
      android: {
        priority: 'HIGH',
        ttl: `${TTL_SECONDS}s`,
        collapse_key: message.tag,
        // число на значке (там, где лаунчер Android его показывает)
        notification: { tag: message.tag, channel_id: 'default', ...(typeof message.badge === 'number' ? { notification_count: message.badge } : {}) },
      },
    },
  }
}

function errorCodeOf(body: string): string | undefined {
  try {
    const parsed = JSON.parse(body) as { error?: { status?: string; details?: { errorCode?: string }[] } }
    return parsed.error?.details?.find((d) => d.errorCode)?.errorCode ?? parsed.error?.status
  } catch {
    return undefined
  }
}

// Настоящая отправка: токен доступа кэшируется, при 401 обновляется один раз
export function createFcmSender(account: ServiceAccount, fetchFn: Fetch = fetch as unknown as Fetch, now: () => number = Date.now): FcmSend {
  let cached: { token: string; expiresAt: number } | undefined

  async function accessToken(force = false): Promise<string> {
    if (!force && cached && cached.expiresAt - TOKEN_REFRESH_MARGIN_SECONDS * 1000 > now()) return cached.token
    const assertion = signJwt(account, Math.floor(now() / 1000))
    const res = await fetchFn(account.token_uri ?? DEFAULT_TOKEN_URI, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: `grant_type=${encodeURIComponent('urn:ietf:params:oauth:grant-type:jwt-bearer')}&assertion=${encodeURIComponent(assertion)}`,
    })
    const text = await res.text()
    const parsed = res.status === 200 ? (JSON.parse(text) as { access_token?: string; expires_in?: number }) : undefined
    if (!parsed?.access_token) throw new Error(`fcm_auth_failed ${res.status}`)
    cached = { token: parsed.access_token, expiresAt: now() + (parsed.expires_in ?? TOKEN_LIFETIME_SECONDS) * 1000 }
    return cached.token
  }

  async function post(token: string, message: PushMessage, bearer: string) {
    return fetchFn(`https://fcm.googleapis.com/v1/projects/${account.project_id}/messages:send`, {
      method: 'POST',
      headers: { authorization: `Bearer ${bearer}`, 'content-type': 'application/json' },
      body: JSON.stringify(buildFcmMessage(token, message)),
    })
  }

  return async (token, message) => {
    let res = await post(token, message, await accessToken())
    // токен доступа мог отозваться раньше срока: берём новый и повторяем один раз
    if (res.status === 401) res = await post(token, message, await accessToken(true))
    const body = res.status === 200 ? '' : await res.text()
    return { status: res.status, errorCode: res.status === 200 ? undefined : errorCodeOf(body), retryAfter: res.headers.get('retry-after') }
  }
}

// Провайдер очереди для подписок вида fcm; классификация ошибок как у Web Push: постоянные (повторять бессмысленно), временные (повторить
// позже) и «устройство больше не существует» (подписку удаляем, строку снимаем без шума).
export function createFcmProvider(db: Db, send: FcmSend, enabled: boolean) {
  return async (payload: PushPayload): Promise<Outcome> => {
    if (!enabled) return { kind: 'fail', error: 'fcm_not_configured' }

    const { rows } = await db.query<{ endpoint: string }>('select endpoint from push_subscriptions where id = $1', [payload.subscriptionId])
    const sub = rows[0]
    // подписку успели удалить
    if (!sub) return { kind: 'skip', reason: 'subscription_gone' }

    let res: FcmResponse
    try {
      res = await send(sub.endpoint, payload.message)
    } catch (err) {
      // сеть или не удалось получить токен доступа: временная ошибка
      return { kind: 'retry', error: `network ${(err as Error).message}`.trim() }
    }
    if (res.status === 200) return { kind: 'sent' }

    // приложение удалено или токен устарел (или принадлежит другому проекту Firebase): шлём впустую, подписку убираем
    if (res.status === 404 || res.errorCode === 'UNREGISTERED' || res.errorCode === 'SENDER_ID_MISMATCH') {
      await db.query('delete from push_subscriptions where id = $1', [payload.subscriptionId])
      return { kind: 'skip', reason: 'subscription_gone' }
    }
    const error = `${res.status} ${res.errorCode ?? ''}`.trim()
    // запрос или права настроены неверно: повтор не поможет
    if (res.status === 400 || res.status === 401 || res.status === 403) return { kind: 'fail', error }
    // 429, 5xx: временно; Retry-After удлиняет паузу
    return { kind: 'retry', error, retryAfterSeconds: parseRetryAfter(res.retryAfter ?? undefined) }
  }
}

// Реальный провайдер из окружения; без ключа сервисного аккаунта push на телефоны выключен
export function fcmProviderFromEnv(db: Db) {
  const account = parseServiceAccount(process.env.FCM_SERVICE_ACCOUNT_BASE64)
  return { provider: createFcmProvider(db, account ? createFcmSender(account) : async () => ({ status: 0 }), account !== null), enabled: account !== null }
}
