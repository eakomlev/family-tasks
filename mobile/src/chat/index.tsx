import { useMemo, type ReactNode } from 'react'
import { useListChatsQuery } from '@/store/chat'
import { ChatsContext } from './context'

// Список чатов с непрочитанным: нужен и странице «Чат», и значку на панели табов.
// Лежит в кэше (после перезапуска виден сразу), обновляется по сигналам сокета (новое сообщение, прочтение на другом устройстве)
// и после отправки или отметки «прочитано».
export function ChatsProvider({ children }: { children: ReactNode }) {
  const { data } = useListChatsQuery()
  const chats = data?.chats

  const value = useMemo(() => ({ chats, unread: chats?.reduce((sum, c) => (c.archived ? sum : sum + c.unread), 0) ?? 0 }), [chats])
  return <ChatsContext value={value}>{children}</ChatsContext>
}
