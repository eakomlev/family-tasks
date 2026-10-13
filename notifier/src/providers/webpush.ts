import webpush from 'web-push'
import { isAllowedEndpoint } from '../allowlist.js'
import type { PushPayload } from '../contract.js'
import type { Db } from '../db.js'
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

export function createPushProvider(db: Db, send: SendNotification, enabled: boolean) {
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
      return { kind: 'retry', error, retryAfterSeconds: parseRetryAfter(e.headers?.['retry-after']) }
    }
  }
}

// Реальная отправка через web-push; ключи VAPID берутся из окружения. Без них push выключен.
export function pushProviderFromEnv(db: Db) {
  const publicKey = process.env.VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  const enabled = Boolean(publicKey && privateKey)
  if (enabled) {
    webpush.setVapidDetails(process.env.VAPID_SUBJECT ?? 'mailto:admin@family-tasks.local', publicKey!, privateKey!)
  }
  return createPushProvider(db, (sub, body, options) => webpush.sendNotification(sub, body, options), enabled)
}
