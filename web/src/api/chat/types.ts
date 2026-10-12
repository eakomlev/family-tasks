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

export interface ChatMessage {
  id: string
  senderId: string
  text: string
  // ISO-время
  createdAt: string
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
