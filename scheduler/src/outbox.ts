import type { Db } from './db.js'
import { PAYLOAD_VERSION, PRIORITY_PLANNED, PUSH_TTL_SECONDS, type PushMessage } from './contract.js'

// Кладёт плановое push-сообщение в таблицу outbox и будит notifier. Если db это клиент транзакции, строка появится
// вместе с остальными изменениями (и сигнал уйдёт при фиксации). Склейки по tag нет: у плановых tag уникальны,
// а дубли исключает notification_log. Отправляет сам notifier.
export async function enqueuePush(db: Db, subscriptionId: string, message: PushMessage): Promise<void> {
  await db.query(
    `with ins as (
       insert into outbox (channel, priority, payload, expires_at)
       values ('push', $1, $2, now() + make_interval(secs => $3))
       returning id
     )
     select pg_notify('outbox', id::text) from ins`,
    [PRIORITY_PLANNED, JSON.stringify({ v: PAYLOAD_VERSION, subscriptionId, message }), PUSH_TTL_SECONDS],
  )
}
