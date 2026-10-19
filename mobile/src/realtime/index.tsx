import { useEffect, useMemo, useRef, type ReactNode } from 'react'
import { AppState } from 'react-native'
import NetInfo from '@react-native-community/netinfo'
import { RealtimeContext } from './context'
import type { Listener, RealtimeContextValue } from './types'
import { CLOSE_UNAUTHORIZED, nextDelay, parseMessage, socketUrl } from './utils'
import { setViewingChat } from './viewing'

// после такой паузы в фоне считаем, что события могли пропасть
const RESYNC_AFTER_BACKGROUND_MS = 5000

// Одно WebSocket-соединение на вход: сервер присылает сигналы об изменениях в семье, экраны по ним обновляют данные.
// Переподключается само (с нарастающей паузой), после восстановления связи просит все экраны обновиться.
export function RealtimeProvider({ token, children }: { token: string; children: ReactNode }) {
  const listeners = useRef(new Set<Listener>())
  // открытый чат и функция, которая отправляет его текущему соединению (задаёт эффект ниже)
  const viewing = useRef<string | null>(null)
  const reportViewing = useRef<() => void>(() => {})

  const value = useMemo<RealtimeContextValue>(
    () => ({
      subscribe(listener) {
        listeners.current.add(listener)
        return () => void listeners.current.delete(listener)
      },
      setViewing(chat) {
        viewing.current = chat
        setViewingChat(chat)
        reportViewing.current()
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
    let backgroundAt: number | undefined
    let ready = false

    // приложение в фоне — чат никто не смотрит
    function sendViewing() {
      if (socket?.readyState !== WebSocket.OPEN || !ready) return
      const chat = AppState.currentState === 'active' ? viewing.current : null
      socket.send(JSON.stringify({ type: 'viewing', chat }))
    }
    reportViewing.current = sendViewing

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
          ready = true
          sendViewing()
          // после обрыва могли пропасть события: пусть экраны обновятся целиком
          if (connectedBefore) emit({ type: 'resync' })
          connectedBefore = true
        } else {
          emit(message)
        }
      }
      ws.onclose = (e) => {
        if (socket === ws) {
          socket = undefined
          ready = false
        }
        if (stopped || e.code === CLOSE_UNAUTHORIZED) return
        timer = setTimeout(connect, nextDelay(attempt++))
      }
    }

    // приложение снова на виду или вернулась сеть: подключаемся сразу, не дожидаясь паузы, и обновляем данные
    const appState = AppState.addEventListener('change', (state) => {
      sendViewing()
      if (state !== 'active') {
        backgroundAt ??= Date.now()
        return
      }
      const wasAwayFor = backgroundAt === undefined ? 0 : Date.now() - backgroundAt
      backgroundAt = undefined
      if (!socket) connect()
      if (wasAwayFor >= RESYNC_AFTER_BACKGROUND_MS) emit({ type: 'resync' })
    })
    let hadNetwork = true
    const unsubscribeNet = NetInfo.addEventListener((state) => {
      const online = state.isConnected !== false
      if (online && !hadNetwork) connect()
      hadNetwork = online
    })

    connect()
    return () => {
      stopped = true
      clearTimeout(timer)
      appState.remove()
      unsubscribeNet()
      reportViewing.current = () => {}
      socket?.close()
    }
  }, [token])

  return <RealtimeContext value={value}>{children}</RealtimeContext>
}
