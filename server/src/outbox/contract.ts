
// Контракт между server и будущим сервисом notifier (docs/notification-queue-plan.md).
// Менять можно только обратно совместимо: несовместимое изменение требует новой версии `v`.

export interface PushMessage {
  title: string
  body: string
  // куда ведёт нажатие на уведомление
  url: string
  // уведомления с одним tag заменяют друг друга
  tag: string
}

export const PAYLOAD_VERSION = 1

// Чем меньше число, тем раньше отправляется.
export const PRIORITY = {
  code: 0, // коды входа: живут 10 минут
  event: 1, // реакции на действия людей: чат, задания, цели
  planned: 2, // плановые: дни рождения, уроки, тренировки
} as const

export type Priority = (typeof PRIORITY)[keyof typeof PRIORITY]

export interface EmailPayload {
  v: typeof PAYLOAD_VERSION
  kind: 'code'
  to: string
  code: string
  ttlMinutes: number
}

export interface PushPayload {
  v: typeof PAYLOAD_VERSION
  subscriptionId: string
  message: PushMessage
}

export type OutboxItem =
  | { channel: 'email'; priority: Priority; payload: EmailPayload }
  | { channel: 'push'; priority: Priority; payload: PushPayload }
