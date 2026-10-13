import type { ChatMessage } from '@/api'
import type { MessageStatus } from '../../utils'

export interface MessageBubbleProps {
  message: ChatMessage
  mine: boolean
  // как подписать автора (имя или «Мама»); имя над чужим сообщением показываем только в общем чате
  senderName?: string
  // настроение автора (смайлик справа от имени), если выбрано сегодня
  senderMood?: string
  showSender: boolean
  // статус своего сообщения: отправлено или прочитано; у чужих не показывается
  status?: MessageStatus
  // родитель может нажать на сообщение ребёнка, чтобы поставить реакцию или начислить монеты
  onFeedback?: () => void
  // нажатие на фото: открыть просмотр с этим номером
  onOpenPhoto?: (index: number) => void
}
