import type { ChatMessage, Member } from '@/api'
import type { MessageStatus } from '../../utils'

export interface MessageBubbleProps {
  message: ChatMessage
  mine: boolean
  // автор; имя над чужим сообщением показываем только в общем чате
  sender?: Member
  showSender: boolean
  // статус своего сообщения: отправлено или прочитано; у чужих не показывается
  status?: MessageStatus
}
