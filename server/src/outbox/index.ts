import type pg from 'pg'
import type { PushMessage } from '../notifications/messages.js'
import { pushEnabled } from '../push.js'
import { PRIORITY, type OutboxItem, type Priority } from './contract.js'
import { enqueueRow } from './queueDriver.js'

export type Db = pg.Pool | pg.PoolClient

// Единственная точка, через которую приложение отправляет письма и push: элемент кладётся в таблицу outbox, а отправляет
// сервис notifier (лимиты, повторы, ключи и SMTP только у него). Если db это клиент транзакции, строка появится вместе
// с остальными изменениями, а сигнал для notifier уйдёт при фиксации. Интерфейс не привязан к хранилищу очереди.
export async function enqueue(db: Db, item: OutboxItem): Promise<void> {
  await enqueueRow(db, item)
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
