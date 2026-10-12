import type { ChatSummary } from '@/api'

export interface ChatsContextValue {
  // undefined, пока список не загружен
  chats?: ChatSummary[]
  // всего непрочитанных сообщений (для значка на табе)
  unread: number
}
