import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { listChats, type ChatSummary } from '@/api'
import { useLive } from '@/realtime/context'
import { ChatsContext } from './context'

// Список чатов с непрочитанным: нужен и странице «Чат», и значку на панели табов.
// Обновляется по сигналам сокета (новое сообщение, прочтение на другом устройстве).
export function ChatsProvider({ token, children }: { token: string; children: ReactNode }) {
  const [chats, setChats] = useState<ChatSummary[]>()

  // при сбое список остаётся прежним и обновится при следующем сигнале
  const refresh = useCallback(
    () => listChats(token).then((res) => setChats(res.chats), () => {}),
    [token],
  )

  useEffect(() => {
    let cancelled = false
    listChats(token).then((res) => !cancelled && setChats(res.chats), () => {})
    return () => { cancelled = true }
  }, [token])
  useLive(['chat'], () => void refresh())

  const value = useMemo(
    () => ({ chats, unread: chats?.reduce((sum, c) => sum + c.unread, 0) ?? 0, refresh }),
    [chats, refresh],
  )
  return <ChatsContext value={value}>{children}</ChatsContext>
}
