import webpush from 'web-push'
import { isAllowedEndpoint } from '../allowlist.js'
import type { PushPayload } from '../contract.js'
import type { Db } from '../db.js'
import { hostGroup, MAX_SLEEP_MS, type PushGate } from '../limits.js'
import type { Log } from '../log.js'
import { parseRetryAfter } from '../retry.js'
import type { Outcome } from '../outcome.js'

// Если устройство долго недоступно, уведомление уже не нужно.
const PUSH_TTL_SECONDS = 6 * 60 * 60

export type SendNotification = (
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
  body: string,
  options: { TTL: number },
) => Promise<unknown>

interface PushError {
  statusCode?: number
  headers?: Record<string, string>
  message?: string
}

export interface PushProviderOptions {
  // ограничение скорости по группам push-сервисов; без него отправка без пауз
  gate?: PushGate
  log?: Log
  sleep?: (ms: number) => Promise<void>
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

export function createPushProvider(db: Db, send: SendNotification, enabled: boolean, options: PushProviderOptions = {}) {
  const { gate, log, sleep = defaultSleep } = options
  return async (payload: PushPayload): Promise<Outcome> => {
    if (!enabled) return { kind: 'fail', error: 'push_not_configured' }

    const { rows } = await db.query<{ endpoint: string; p256dh: string; auth: string }>(
      'select endpoint, p256dh, auth from push_subscriptions where id = $1',
      [payload.subscriptionId],
    )
    const sub = rows[0]
    // подписку успели удалить
    if (!sub) return { kind: 'skip', reason: 'subscription_gone' }
    if (!isAllowedEndpoint(sub.endpoint)) return { kind: 'fail', error: 'endpoint_not_allowed' }

    if (gate) {
      const wait = gate.waitMs(sub.endpoint)
      if (wait > MAX_SLEEP_MS) {
        gate.refund(sub.endpoint)
        return { kind: 'defer', seconds: Math.ceil(wait / 1000), reason: 'rate_limited' }
      }
      if (wait > 0) await sleep(wait)
    }

    try {
      await send({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, JSON.stringify(payload.message), {
        TTL: PUSH_TTL_SECONDS,
      })
      return { kind: 'sent' }
    } catch (err) {
      const e = err as PushError
      const status = e.statusCode
      // подписка отозвана или устарела: удаляем, чтобы не слать впустую
      if (status === 404 || status === 410) {
        await db.query('delete from push_subscriptions where id = $1', [payload.subscriptionId])
        return { kind: 'skip', reason: 'subscription_gone' }
      }
      const error = `${status ?? 'network'} ${e.message ?? ''}`.trim()
      // запрос отклонён из-за самого запроса или ключей: повтор не поможет
      if (status === 400 || status === 401 || status === 403 || status === 413) return { kind: 'fail', error }
      const retryAfterSeconds = parseRetryAfter(e.headers?.['retry-after'])
      // сервис просит подождать: притормаживаем всю его группу, а не только эту строку
      if (gate && retryAfterSeconds) {
        gate.pause(sub.endpoint, retryAfterSeconds)
        log?.('warn', 'provider_throttled', { provider: 'push', group: hostGroup(sub.endpoint), seconds: retryAfterSeconds })
      }
      return { kind: 'retry', error, retryAfterSeconds }
    }
  }
}

// Реальная отправка через web-push; ключи VAPID берутся из окружения. Без них push выключен.
export function pushProviderFromEnv(db: Db, options: PushProviderOptions = {}) {
  const publicKey = process.env.VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  const enabled = Boolean(publicKey && privateKey)
  if (enabled) {
    webpush.setVapidDetails(process.env.VAPID_SUBJECT ?? 'mailto:admin@family-tasks.local', publicKey!, privateKey!)
  }
  return createPushProvider(db, (sub, body, opts) => webpush.sendNotification(sub, body, opts), enabled, options)
}
