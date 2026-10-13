import { sendCode } from '../mail.js'
import { sendPush } from '../push.js'
import type { Db } from './index.js'
import type { EnqueueResult, OutboxItem } from './contract.js'

// Временный драйвер: отправляет сразу, как раньше. Заменяется записью в таблицу outbox (фаза 2 плана).
// Письмо: ошибка отправки пробрасывается (при регистрации обработчик отвечает 502).
export async function deliver(db: Db, item: OutboxItem): Promise<EnqueueResult> {
  if (item.channel === 'email') {
    const { to, code, ttlMinutes } = item.payload
    await sendCode(to, code, ttlMinutes)
    return 'sent'
  }

  const { rows } = await db.query(
    'select id, endpoint, p256dh, auth from push_subscriptions where id = $1',
    [item.payload.subscriptionId],
  )
  // подписку успели удалить
  if (!rows[0]) return 'gone'
  return sendPush(rows[0], item.payload.message)
}
