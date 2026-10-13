import type { Db } from './index.js'
import type { EnqueueResult, OutboxItem } from './contract.js'

// Сколько push остаётся актуальным (как TTL при отправке); письмо с кодом живёт столько же, сколько сам код.
const PUSH_TTL_SECONDS = 6 * 60 * 60

// Кладёт элемент в таблицу outbox и будит notifier. Если db это клиент транзакции, строка появится вместе с
// остальными изменениями (и сигнал уйдёт при фиксации). Отправляет сам notifier.
export async function enqueueRow(db: Db, item: OutboxItem): Promise<EnqueueResult> {
  const ttlSeconds = item.channel === 'email' ? item.payload.ttlMinutes * 60 : PUSH_TTL_SECONDS
  await db.query(
    `with ins as (
       insert into outbox (channel, priority, payload, expires_at)
       values ($1, $2, $3, now() + make_interval(secs => $4))
       returning id
     )
     select pg_notify('outbox', id::text) from ins`,
    [item.channel, item.priority, JSON.stringify(item.payload), ttlSeconds],
  )
  return 'queued'
}
