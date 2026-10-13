// Копия части контракта очереди outbox версии 1 (источник: server/src/outbox/contract.ts, образец payload:
// ../contracts/outbox-v1.json). scheduler только кладёт плановые push; код server и scheduler друг друга не импортируют.
// Менять можно только обратно совместимо.

export const PAYLOAD_VERSION = 1

// Плановые: дни рождения, уроки, тренировки (меньше число, раньше отправка).
export const PRIORITY_PLANNED = 2

// Сколько push остаётся актуальным (как у server).
export const PUSH_TTL_SECONDS = 6 * 60 * 60

export interface PushMessage {
  title: string
  body: string
  // куда ведёт нажатие на уведомление
  url: string
  // уведомления с одним tag заменяют друг друга
  tag: string
}

export interface PushPayload {
  v: typeof PAYLOAD_VERSION
  subscriptionId: string
  message: PushMessage
}
