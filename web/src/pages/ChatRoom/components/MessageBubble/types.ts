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
  // Аватар автора слева от чужого сообщения в групповом чате, как в Телеграме: у последнего сообщения подряд от одного автора его аватар,
  // у предыдущих пустое место такой же ширины (null); undefined: аватарной колонки нет (свои сообщения, личные чаты)
  senderAvatar?: { name: string; seed: string; src?: string | null } | null
  // статус своего сообщения: отправлено или прочитано; у чужих не показывается
  status?: MessageStatus
  // родитель может нажать на сообщение ребёнка, чтобы поставить реакцию или начислить монеты
  onFeedback?: () => void
  // как подписать автора исходного сообщения, если это ответ
  replyAuthor?: string
  // нажатие на фото: открыть просмотр с этим номером
  onOpenPhoto?: (index: number) => void
  // нажатие на видео: открыть плеер
  onOpenVideo?: (index: number) => void
}
