import type { ChatMessage, MessageFeedback } from '@/api'

export interface FeedbackDialogProps {
  message: ChatMessage
  // как называть автора сообщения (имя ребёнка)
  authorName: string
  // можно ли начислить монеты автору (родитель и сообщение ребёнка); иначе только реакция
  canAward: boolean
  // моя текущая реакция на это сообщение (если есть)
  myEmoji?: string
  // применяет выбор сразу; бросает ошибку, если не вышло (окно остаётся открытым и показывает её)
  onSubmit: (feedback: MessageFeedback) => Promise<void>
  // действия над сообщением: ответить (любое), изменить и удалить (только своё); кнопки есть, если действие передано
  onReply?: () => void
  // копировать и переслать текст сообщения (у сообщения только с вложениями кнопок нет); копирование бросает ошибку, если не вышло
  onCopy?: () => Promise<void>
  onForward?: () => void
  onEdit?: () => void
  // бросает ошибку, если не вышло
  onDelete?: () => Promise<void>
  onClose: () => void
}
