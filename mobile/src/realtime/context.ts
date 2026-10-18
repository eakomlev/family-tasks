import { createContext, useContext, useEffect, useRef } from 'react'
import type { Listener, RealtimeContextValue, RealtimeEvent, Topic } from './types'

export const RealtimeContext = createContext<RealtimeContextValue | null>(null)

// Вызывает onChange, когда по сокету пришло событие одной из тем (или нужно обновить всё: resync).
// По событию надо заново запросить данные обычным запросом. Без провайдера (экраны без входа) ничего не делает.
export function useLive(topics: Topic[], onChange: (event: RealtimeEvent) => void) {
  const realtime = useContext(RealtimeContext)
  const handler = useRef(onChange)
  useEffect(() => {
    handler.current = onChange
  })
  const key = topics.join(',')

  useEffect(() => {
    if (!realtime) return
    const wanted = new Set<string>([...key.split(','), 'resync'])
    const listener: Listener = (event) => {
      if (wanted.has(event.type)) handler.current(event)
    }
    return realtime.subscribe(listener)
  }, [realtime, key])
}

// Сообщает серверу, что чат открыт на экране, пока компонент смонтирован (и вкладка на виду): пуши о его сообщениях не приходят.
export function useViewingChat(chat: string | undefined) {
  const realtime = useContext(RealtimeContext)
  useEffect(() => {
    if (!realtime || !chat) return
    realtime.setViewing(chat)
    return () => realtime.setViewing(null)
  }, [realtime, chat])
}
