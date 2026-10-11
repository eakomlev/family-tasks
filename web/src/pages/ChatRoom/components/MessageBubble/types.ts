import type { ChatMessage } from '@/api'
import type { MessageStatus } from '../../utils'

export interface MessageBubbleProps {
  message: ChatMessage
  mine: boolean
  // как подписать автора (имя или «Мама»); имя над чужим сообщением показываем только в общем чате
  senderName?: string
  showSender: boolean
  // статус своего сообщения: отправлено или прочитано; у чужих не показывается
  status?: MessageStatus
}
