import type { PushPayload } from '../contract.js'
import type { Db } from '../db.js'
import type { Outcome } from '../outcome.js'

type PushProvider = (payload: PushPayload) => Promise<Outcome>

// Сообщение в очереди ссылается на подписку по id, а вид доставки (браузер или приложение на телефоне) записан в самой подписке:
// формат очереди не менялся, выбирает провайдера notifier.
export function createPushRouter(db: Db, providers: { web: PushProvider; fcm: PushProvider }): PushProvider {
  return async (payload) => {
    const { rows } = await db.query<{ kind: string }>('select kind from push_subscriptions where id = $1', [payload.subscriptionId])
    const sub = rows[0]
    // подписку успели удалить
    if (!sub) return { kind: 'skip', reason: 'subscription_gone' }
    if (sub.kind === 'fcm') return providers.fcm(payload)
    if (sub.kind === 'web') return providers.web(payload)
    return { kind: 'fail', error: `unknown_push_kind ${sub.kind}` }
  }
}
