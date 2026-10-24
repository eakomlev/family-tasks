// Реакция родителя под сообщением ребёнка
export interface Reaction {
  memberId: string
  emoji: string
}

// Начисление монет родителем за сообщение ребёнка (by: null, если автор неизвестен)
export interface Award {
  amount: number
  by: string | null
}

// Фото в сообщении: размеры известны заранее (лента не прыгает), адреса подписаны сервером и действуют не меньше суток
export interface ChatMedia {
  id: string
  width: number
  height: number
  thumbUrl: string
  fullUrl: string
}

// Фото в списке всех фото чата: то же, что в сообщении, плюс откуда оно
export interface ChatMediaItem extends ChatMedia {
  messageId: string
  senderId: string
  createdAt: string
}

// Файл в сообщении (документ, архив…): url ведёт на скачивание
export interface ChatFile {
  id: string
  name: string
  size: number
  url: string
}

// Выдержка из сообщения, на которое ответили
export interface ChatReply {
  id: string
  senderId: string
  text: string
}

export interface ChatMessage {
  id: string
  senderId: string
  // как лежит на сервере: подпись или, у сообщения только с фото, заглушка «📷 Фото» (для старых версий приложения)
  text: string
  // подпись к фото; у сообщения без фото равна text, у сообщения только с фото пустая
  caption: string
  media: ChatMedia[]
  // обычные файлы; нет у сообщений из кэша и ответов прежней версии сервера
  files?: ChatFile[]
  // ISO-время
  createdAt: string
  // ответ на сообщение (нет, если это не ответ, исходное удалено или сервер прежней версии)
  replyTo?: ChatReply | null
  // ISO-время правки; нет, если сообщение не менялось
  editedAt?: string | null
  reactions: Reaction[]
  awards: Award[]
}

// Что родитель делает с сообщением ребёнка: поставить реакцию (null снимает свою) и/или начислить монеты
export interface MessageFeedback {
  emoji?: string | null
  coins?: number
}

// Чат в списке. id: «family» для общего чата или id собеседника для личного.
export interface ChatSummary {
  id: string
  // null — сообщений ещё нет
  last: ChatMessage | null
  unread: number
  // уведомления этого чата отключены у меня (в ответе прежней версии сервера поля нет)
  muted?: boolean
  // ISO-время, до которого прочитали остальные участники чата: по нему у моего последнего сообщения галочка «прочитано»
  // (в ответе прежней версии сервера поля нет: статус не показываем)
  readUpTo?: string | null
}

export interface MessagePage {
  // старые сверху
  messages: ChatMessage[]
  // есть ли ещё более старые
  hasMore: boolean
  // ISO-время, до которого прочитали остальные участники чата (в общем чате все); по нему свои сообщения получают отметку «прочитано»
  readUpTo: string | null
  // только в личном чате: собеседник сейчас в чате и когда был в нём в последний раз (ISO)
  peer: { viewing: boolean; lastVisitAt: string | null } | null
}

// Найденное сообщение (поиск по чату)
export interface ChatSearchResult {
  id: string
  senderId: string
  text: string
  createdAt: string
}

// Ссылка из сообщения чата (вкладка «Ссылки»)
export interface ChatLink {
  url: string
  messageId: string
  senderId: string
  createdAt: string
}
