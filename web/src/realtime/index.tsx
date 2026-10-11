import { useEffect, useMemo, useRef, type ReactNode } from 'react'
import { RealtimeContext } from './context'
import type { Listener, RealtimeContextValue } from './types'
import { CLOSE_UNAUTHORIZED, nextDelay, parseMessage, socketUrl } from './utils'

// после такой паузы вкладки считаем, что события могли пропасть
const RESYNC_AFTER_HIDDEN_MS = 5000

// Одно WebSocket-соединение на вход: сервер присылает сигналы об изменениях в семье, страницы по ним обновляют данные.
// Переподключается сам (с нарастающей паузой), после восстановления связи просит все страницы обновиться.
export function RealtimeProvider({ token, children }: { token: string; children: ReactNode }) {
  const listeners = useRef(new Set<Listener>())

  const value = useMemo<RealtimeContextValue>(
    () => ({
      subscribe(listener) {
        listeners.current.add(listener)
        return () => void listeners.current.delete(listener)
      },
    }),
    [],
  )

  useEffect(() => {
    let socket: WebSocket | undefined
    let timer: ReturnType<typeof setTimeout> | undefined
    let attempt = 0
    let stopped = false
    let connectedBefore = false
    let hiddenAt: number | undefined

    const emit = (event: Parameters<Listener>[0]) => listeners.current.forEach((listener) => listener(event))

    function connect() {
      clearTimeout(timer)
      if (stopped || socket) return
      const ws = new WebSocket(socketUrl())
      socket = ws

      ws.onopen = () => ws.send(JSON.stringify({ type: 'auth', token }))
      ws.onmessage = (e) => {
        const message = parseMessage(e.data)
        if (!message) return
        if (message.type === 'ready') {
          attempt = 0
          // после обрыва могли пропасть события: пусть страницы обновятся целиком
          if (connectedBefore) emit({ type: 'resync' })
          connectedBefore = true
        } else {
          emit(message)
        }
      }
      ws.onclose = (e) => {
        if (socket === ws) socket = undefined
        if (stopped || e.code === CLOSE_UNAUTHORIZED) return
        timer = setTimeout(connect, nextDelay(attempt++))
      }
    }

    // вкладка снова на виду или вернулась сеть: подключаемся сразу, не дожидаясь паузы, и обновляем данные
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        hiddenAt = Date.now()
        return
      }
      const wasHiddenFor = hiddenAt === undefined ? 0 : Date.now() - hiddenAt
      hiddenAt = undefined
      if (!socket) connect()
      if (wasHiddenFor >= RESYNC_AFTER_HIDDEN_MS) emit({ type: 'resync' })
    }
    const onOnline = () => connect()

    connect()
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('online', onOnline)
    return () => {
      stopped = true
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('online', onOnline)
      socket?.close()
    }
  }, [token])

  return <RealtimeContext value={value}>{children}</RealtimeContext>
}
