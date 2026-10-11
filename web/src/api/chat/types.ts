export interface ChatMessage {
  id: string
  senderId: string
  text: string
  // ISO-время
  createdAt: string
}

// Чат в списке. id: «family» для общего чата или id собеседника для личного.
export interface ChatSummary {
  id: string
  // null — сообщений ещё нет
  last: ChatMessage | null
  unread: number
}

export interface MessagePage {
  // старые сверху
  messages: ChatMessage[]
  // есть ли ещё более старые
  hasMore: boolean
  // ISO-время, до которого прочитали остальные участники чата (в общем чате все); по нему свои сообщения получают отметку «прочитано»
  readUpTo: string | null
}
