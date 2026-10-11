import type { FastifyInstance } from 'fastify'
import type { WebSocket } from 'ws'
import { authenticateToken } from './auth.js'
import { hashToken } from './codes.js'
import { pool } from './db.js'

// Что изменилось в данных семьи. Клиент по этому сигналу сам перезапрашивает нужные данные:
// в событии нет самих данных, поэтому доступ к ним по-прежнему проверяют обычные запросы.
export type RealtimeEvent =
  | { type: 'tasks' }
  | { type: 'members' }
  | { type: 'schedule'; memberId: string }
  | { type: 'trainings'; memberId: string }

interface Client {
  socket: WebSocket
  familyId: string
  tokenHash: string
  alive: boolean
}

// коды закрытия соединения (4000-4999 свободны для приложения)
export const CLOSE_UNAUTHORIZED = 4401

const AUTH_TIMEOUT_MS = 10_000
const PING_INTERVAL_MS = 30_000
// авторизующее сообщение крошечное, больше ничего от клиента не ждём
const MAX_PAYLOAD = 2048

const clients = new Set<Client>()

function send(client: Client, message: object) {
  if (client.socket.readyState === client.socket.OPEN) client.socket.send(JSON.stringify(message))
}

// Рассылает событие всем подключённым участникам семьи (в том числе тому, кто его вызвал: его другие устройства тоже должны обновиться).
export function publish(familyId: string, event: RealtimeEvent) {
  for (const client of clients) {
    if (client.familyId === familyId) send(client, event)
  }
}

// То же по участнику: семью определяем по нему (расписания знают только id ребёнка).
export async function publishForMember(memberId: string, event: RealtimeEvent) {
  const { rows } = await pool.query('select family_id from members where id = $1', [memberId])
  if (rows[0]) publish(rows[0].family_id as string, event)
}

// После выхода с устройства его соединение закрывается.
export function closeSession(token: string) {
  const tokenHash = hashToken(token)
  for (const client of clients) {
    if (client.tokenHash === tokenHash) client.socket.close(CLOSE_UNAUTHORIZED, 'session ended')
  }
}

export function connectionCount() {
  return clients.size
}

export async function realtimeRoutes(app: FastifyInstance) {
  // Живые обновления: GET /api/ws, затем первым сообщением {"type":"auth","token":"..."}.
  // Токен не передаём в адресе: адреса попадают в журналы прокси.
  app.get('/api/ws', { websocket: true }, (socket) => {
    let client: Client | undefined
    const authTimer = setTimeout(() => socket.close(CLOSE_UNAUTHORIZED, 'auth timeout'), AUTH_TIMEOUT_MS)

    socket.on('message', async (raw: Buffer) => {
      if (client) return // после входа клиент ничего не присылает
      let token: unknown
      try {
        const message = JSON.parse(raw.toString())
        if (message?.type === 'auth') token = message.token
      } catch {
        /* не JSON: ниже закроем как неавторизованного */
      }
      const member = typeof token === 'string' ? await authenticateToken(token).catch(() => null) : null
      if (!member || socket.readyState !== socket.OPEN) return socket.close(CLOSE_UNAUTHORIZED, 'unauthorized')

      clearTimeout(authTimer)
      client = { socket, familyId: member.family_id, tokenHash: hashToken(token as string), alive: true }
      clients.add(client)
      send(client, { type: 'ready' })
    })

    socket.on('pong', () => {
      if (client) client.alive = true
    })
    socket.on('close', () => {
      clearTimeout(authTimer)
      if (client) clients.delete(client)
    })
    socket.on('error', () => socket.terminate())
  })

  // Проверка живости: молчащее соединение (телефон потерял сеть) закрываем, не дожидаясь таймаутов TCP.
  const heartbeat = setInterval(() => {
    for (const client of clients) {
      if (!client.alive) {
        client.socket.terminate()
        clients.delete(client)
        continue
      }
      client.alive = false
      client.socket.ping()
    }
  }, PING_INTERVAL_MS)
  heartbeat.unref()
  app.addHook('onClose', async () => {
    clearInterval(heartbeat)
    for (const client of clients) client.socket.terminate()
    clients.clear()
  })
}

export { MAX_PAYLOAD }
