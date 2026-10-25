import { randomUUID } from 'node:crypto'
import { createServer, type IncomingMessage } from 'node:http'
import type { Duplex } from 'node:stream'
import type pg from 'pg'
import { WebSocketServer, type WebSocket } from 'ws'
import { authenticate, liveSessions } from './auth.js'
import { parseMessage, REALTIME_CHANNEL } from './contract.js'
import { Hub, send, type Client } from './hub.js'
import { startListener } from './listener.js'
import type { Log } from './log.js'
import { beat, dropViewing, housekeeping, recordVisit, refreshViewing, writeViewing } from './state.js'

// коды закрытия соединения (4000-4999 свободны для приложения)
export const CLOSE_UNAUTHORIZED = 4401
// клиенту не нужен новый вход: он переподключится и перезапросит данные
const CLOSE_RESYNC = 1012

const AUTH_TIMEOUT_MS = 10_000
// авторизующее сообщение крошечное, больше клиент присылает только «какой чат открыт»
const MAX_PAYLOAD = 2048
// не больше столько подключений на одного участника (вкладки, устройства); лишние вытесняют самые старые
const MAX_PER_MEMBER = 30
// попыток подключения в минуту с одного адреса (как общий лимит server: семья сидит за одним адресом)
const CONNECTS_PER_MINUTE = 600

export interface RealtimeOptions {
  pool: pg.Pool
  connectionString: string
  log: Log
  // 0: любой свободный порт (тесты)
  port: number
  instance: string
  pingIntervalMs?: number
  sessionCheckMs?: number
  beatMs?: number
}

export interface Realtime {
  port: number
  hub: Hub
  isListening(): boolean
  close(): Promise<void>
}

export async function startRealtime(options: RealtimeOptions): Promise<Realtime> {
  const { pool, connectionString, log, instance } = options
  const pingMs = options.pingIntervalMs ?? 30_000
  const sessionCheckMs = options.sessionCheckMs ?? 60_000
  const beatMs = options.beatMs ?? 15_000
  const hub = new Hub()

  const attempts = new Map<string, { count: number; resetAt: number }>()
  const allowConnect = (ip: string) => {
    const now = Date.now()
    const entry = attempts.get(ip)
    if (!entry || entry.resetAt < now) {
      attempts.set(ip, { count: 1, resetAt: now + 60_000 })
      return true
    }
    entry.count += 1
    return entry.count <= CONNECTS_PER_MINUTE
  }

  const deliver = (payload: string | undefined) => {
    const message = parseMessage(payload)
    if (!message) return
    if (message.to === 'session') return hub.closeSession(message.id, CLOSE_UNAUTHORIZED, 'session ended')
    const text = JSON.stringify(message.event)
    if (message.to === 'family') hub.toFamily(message.id, text)
    else hub.toMember(message.id, text)
  }

  const listener = startListener(
    connectionString,
    REALTIME_CHANNEL,
    {
      onMessage: deliver,
      // сигналы за время обрыва потеряны: пусть клиенты переподключатся и обновят данные
      onRestored: () => hub.closeAll(CLOSE_RESYNC, 'resync'),
    },
    log,
  )

  const wss = new WebSocketServer({ noServer: true, maxPayload: MAX_PAYLOAD })
  const server = createServer((req, res) => {
    if (req.url === '/health') {
      res.writeHead(listener.isListening() ? 200 : 503, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ listening: listener.isListening(), connections: hub.size }))
      return
    }
    res.writeHead(404).end()
  })

  server.on('upgrade', (req: IncomingMessage, socket: Duplex, head) => {
    const path = (req.url ?? '').split('?')[0]
    // адрес клиента nginx передаёт в X-Forwarded-For (один адрес, его собственный remote_addr)
    const forwarded = String(req.headers['x-forwarded-for'] ?? '').split(',')[0]?.trim()
    if (path !== '/api/ws') {
      socket.destroy()
      return
    }
    if (!allowConnect(forwarded || req.socket.remoteAddress || 'unknown')) {
      socket.write('HTTP/1.1 429 Too Many Requests\r\nConnection: close\r\n\r\n')
      socket.destroy()
      return
    }
    wss.handleUpgrade(req, socket, head, (ws) => onConnection(ws))
  })

  function onConnection(socket: WebSocket) {
    let client: Client | undefined
    const authTimer = setTimeout(() => socket.close(CLOSE_UNAUTHORIZED, 'auth timeout'), AUTH_TIMEOUT_MS)

    const setViewing = (chat: string | null) => {
      if (!client || client.viewing === chat) return
      const current = client
      const previous = current.viewing
      current.viewing = chat
      current.work = current.work
        .then(() => writeViewing(pool, current.id, current.memberId, chat))
        .then(() => recordVisit(pool, current.memberId, previous))
        .then(() => recordVisit(pool, current.memberId, chat))
        .catch((err: Error) => log('warn', 'viewing_failed', { error: err.message }))
    }

    socket.on('message', async (raw: Buffer) => {
      if (client) {
        // после входа клиент сообщает только, какой чат у него открыт
        try {
          const message = JSON.parse(raw.toString())
          if (message?.type === 'viewing') {
            setViewing(typeof message.chat === 'string' && message.chat.length <= 64 ? message.chat : null)
          }
        } catch {
          /* не JSON: игнорируем */
        }
        return
      }
      let token: unknown
      try {
        const message = JSON.parse(raw.toString())
        if (message?.type === 'auth') token = message.token
      } catch {
        /* не JSON: ниже закроем как неавторизованного */
      }
      const authed = typeof token === 'string' ? await authenticate(pool, token).catch(() => null) : null
      if (!authed || socket.readyState !== socket.OPEN || client) return socket.close(CLOSE_UNAUTHORIZED, 'unauthorized')

      clearTimeout(authTimer)
      client = { id: randomUUID(), socket, ...authed, alive: true, viewing: null, work: Promise.resolve() }
      // лишние подключения участника вытесняют самые старые: иначе открытые вкладки копились бы без предела
      const existing = hub.ofMember(authed.memberId)
      for (const old of existing.slice(0, Math.max(0, existing.length - MAX_PER_MEMBER + 1))) old.socket.close(CLOSE_RESYNC, 'too many connections')
      hub.add(client)
      send(client, JSON.stringify({ type: 'ready' }))
    })

    socket.on('pong', () => {
      if (client) client.alive = true
    })
    socket.on('close', () => {
      clearTimeout(authTimer)
      if (!client) return
      const current = client
      hub.remove(current)
      if (current.viewing !== null) {
        const last = current.viewing
        current.viewing = null
        current.work = current.work
          .then(() => dropViewing(pool, [current.id]))
          .then(() => recordVisit(pool, current.memberId, last))
          .catch(() => {})
      }
    })
    socket.on('error', () => socket.terminate())
  }

  // Проверка живости: молчащее соединение (телефон потерял сеть) закрываем, не дожидаясь таймаутов TCP; заодно подтверждаем в БД,
  // что устройства с открытым чатом ещё здесь (server считает чат закрытым, если отметку не освежали больше полутора минут).
  const pingTimer = setInterval(() => {
    const viewing: string[] = []
    for (const client of [...hub.clients()]) {
      if (!client.alive) {
        client.socket.terminate()
        continue
      }
      client.alive = false
      client.socket.ping()
      if (client.viewing !== null) viewing.push(client.id)
    }
    refreshViewing(pool, viewing).catch((err: Error) => log('warn', 'viewing_refresh_failed', { error: err.message }))
  }, pingMs)

  // Сессию могли отозвать без сигнала (участник или семья удалены, срок истёк): закрываем такие соединения.
  const sessionTimer = setInterval(async () => {
    try {
      const clients = [...hub.clients()]
      const live = await liveSessions(pool, [...new Set(clients.map((c) => c.tokenHash))])
      for (const client of clients) if (!live.has(client.tokenHash)) client.socket.close(CLOSE_UNAUTHORIZED, 'session ended')
    } catch (err) {
      log('warn', 'session_check_failed', { error: (err as Error).message })
    }
  }, sessionCheckMs)

  // Метку живости ставим, только пока слушаем канал: без него сервис молчит, и проверка контейнера должна это заметить.
  const beatTimer = setInterval(() => {
    if (!listener.isListening()) return
    beat(pool, instance, hub.size)
      .then(() => housekeeping(pool))
      .catch((err: Error) => log('warn', 'heartbeat_failed', { error: err.message }))
  }, beatMs)

  await new Promise<void>((resolve) => server.listen(options.port, resolve))
  const address = server.address()
  const port = typeof address === 'object' && address ? address.port : options.port
  // первая метка сразу, как только слушатель подключится
  void (async () => {
    for (let i = 0; i < 50 && !listener.isListening(); i++) await new Promise((r) => setTimeout(r, 100))
    if (listener.isListening()) await beat(pool, instance, hub.size).catch(() => {})
  })()

  return {
    port,
    hub,
    isListening: () => listener.isListening(),
    async close() {
      clearInterval(pingTimer)
      clearInterval(sessionTimer)
      clearInterval(beatTimer)
      await listener.close()
      const ids = [...hub.clients()].filter((c) => c.viewing !== null).map((c) => c.id)
      for (const client of hub.clients()) client.socket.terminate()
      await dropViewing(pool, ids).catch(() => {})
      await new Promise<void>((resolve) => server.close(() => resolve()))
    },
  }
}
