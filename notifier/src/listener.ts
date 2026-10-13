import pg from 'pg'
import type { Log } from './log.js'

// Подписка на сигнал «в очереди новая строка» (pg_notify из server). Сигнал не хранится, поэтому он только ускоряет
// реакцию: основной цикл всё равно опрашивает таблицу по таймеру. При обрыве соединения подключаемся заново.
export function startListener(connectionString: string, onNotify: () => void, log: Log): { close(): Promise<void> } {
  let client: pg.Client | undefined
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
      if (err) log('warn', 'listener_lost', { error: err.message })
      next.removeAllListeners()
      next.on('error', () => {})
      void next.end().catch(() => {})
      timer = setTimeout(() => void connect(), 5000)
    }
    next.on('error', restart)
    next.on('end', () => restart())
    next.on('notification', () => onNotify())
    try {
      await next.connect()
      await next.query('listen outbox')
    } catch (err) {
      restart(err as Error)
    }
  }
  void connect()

  return {
    async close() {
      closed = true
      if (timer) clearTimeout(timer)
      client?.removeAllListeners()
      client?.on('error', () => {})
      await client?.end().catch(() => {})
    },
  }
}
