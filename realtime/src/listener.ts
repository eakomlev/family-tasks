import pg from 'pg'
import type { Log } from './log.js'

// Постоянное соединение с LISTEN. NOTIFY не хранится: пока соединения нет, сигналы теряются, поэтому после каждого
// восстановления (но не после первого подключения) зовём onRestored: сервис закрывает сокеты, клиенты переподключаются
// и заново запрашивают данные.
export function startListener(
  connectionString: string,
  channel: string,
  handlers: { onMessage: (payload: string | undefined) => void; onRestored: () => void },
  log: Log,
): { isListening(): boolean; close(): Promise<void> } {
  let client: pg.Client | undefined
  let listening = false
  let lost = false
  let closed = false
  let timer: NodeJS.Timeout | undefined

  const connect = async () => {
    if (closed) return
    const next = new pg.Client({ connectionString })
    client = next
    let restarted = false
    const restart = (err?: Error) => {
      if (restarted || closed) return
      restarted = true
      listening = false
      lost = true
      log('warn', 'listener_lost', { error: err?.message })
      next.removeAllListeners()
      next.on('error', () => {})
      void next.end().catch(() => {})
      timer = setTimeout(() => void connect(), 2000)
    }
    next.on('error', restart)
    next.on('end', () => restart())
    next.on('notification', (n) => handlers.onMessage(n.payload))
    try {
      await next.connect()
      await next.query(`listen ${channel}`)
      listening = true
      if (lost) {
        lost = false
        log('info', 'listener_restored')
        handlers.onRestored()
      }
    } catch (err) {
      restart(err as Error)
    }
  }
  void connect()

  return {
    isListening: () => listening,
    async close() {
      closed = true
      listening = false
      if (timer) clearTimeout(timer)
      client?.removeAllListeners()
      client?.on('error', () => {})
      await client?.end().catch(() => {})
    },
  }
}
