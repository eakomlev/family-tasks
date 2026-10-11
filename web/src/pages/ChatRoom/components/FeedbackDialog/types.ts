import type { ChatMessage, MessageFeedback } from '@/api'

export interface FeedbackDialogProps {
  message: ChatMessage
  // как называть автора сообщения (имя ребёнка)
  authorName: string
  // моя текущая реакция на это сообщение (если есть)
  myEmoji?: string
  // отправляет выбор; бросает ошибку, если не вышло (окно остаётся открытым и показывает её)
  onSubmit: (feedback: MessageFeedback) => Promise<void>
  onClose: () => void
}
