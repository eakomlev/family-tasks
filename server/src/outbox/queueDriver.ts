import type { Db } from './index.js'
import type { OutboxItem } from './contract.js'

// Сколько push остаётся актуальным (как TTL при отправке); письмо с кодом живёт столько же, сколько сам код.
const PUSH_TTL_SECONDS = 6 * 60 * 60

// Кладёт элемент в таблицу outbox и будит notifier. Если db это клиент транзакции, строка появится вместе с
// остальными изменениями (и сигнал уйдёт при фиксации). Отправляет сам notifier.
//
// Склейка: ещё не отправленное (attempts = 0) push-сообщение с тем же tag для той же подписки заменяется новым.
// Устройство делает то же самое (уведомление с таким tag заменяет прежнее), так что человек ничего не теряет,
// а провайдеру уходит меньше запросов. Строка, которую notifier уже взял в работу, имеет attempts > 0 и не трогается.
export async function enqueueRow(db: Db, item: OutboxItem): Promise<void> {
  const ttlSeconds = item.channel === 'push' ? PUSH_TTL_SECONDS : item.payload.ttlMinutes * 60
  const tag = item.channel === 'push' ? item.payload.message.tag : ''
  const subscriptionId = item.channel === 'push' ? item.payload.subscriptionId : null
  await db.query(
    `with replaced as (
       delete from outbox
        where $5::text <> '' and channel = 'push' and attempts = 0
          and payload->>'subscriptionId' = $6::text and payload->'message'->>'tag' = $5::text
        returning id
     ), ins as (
       insert into outbox (channel, priority, payload, expires_at)
       values ($1, $2, $3, now() + make_interval(secs => $4))
       returning id
     )
     select pg_notify('outbox', id::text) from ins`,
    [item.channel, item.priority, JSON.stringify(item.payload), ttlSeconds, tag, subscriptionId],
  )
}
