import type pg from 'pg'
import type { PushMessage } from '../notifications/messages.js'
import { pushEnabled } from '../push.js'
import { PRIORITY, type EnqueueResult, type OutboxItem, type Priority } from './contract.js'
import { enqueueRow } from './queueDriver.js'
import { deliver } from './syncDriver.js'

export type Db = pg.Pool | pg.PoolClient

// Единственная точка, через которую приложение отправляет письма и push.
// QUEUE_ENABLED=true: элемент кладётся в таблицу outbox, отправляет сервис notifier (в одной транзакции с действием,
// если db это клиент транзакции). Иначе отправка сразу и прямо здесь, как раньше. Переменная читается при каждом вызове.
export function enqueue(db: Db, item: OutboxItem): Promise<EnqueueResult> {
  return process.env.QUEUE_ENABLED === 'true' ? enqueueRow(db, item) : deliver(db, item)
}

// Уведомление на все устройства участника. Ошибки не пробрасываем, чтобы они не ломали основное действие.
export async function enqueueToMember(
  db: Db,
  memberId: string,
  message: PushMessage,
  priority: Priority = PRIORITY.event,
): Promise<void> {
  if (!pushEnabled) return
  try {
    const { rows } = await db.query<{ id: string }>('select id from push_subscriptions where member_id = $1', [memberId])
    await Promise.all(
      rows.map((sub) => enqueue(db, { channel: 'push', priority, payload: { v: 1, subscriptionId: sub.id, message } })),
    )
  } catch (err) {
    console.error('notify failed', (err as Error).message)
  }
}

export { PRIORITY }
