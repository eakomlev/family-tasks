import { hashToken } from './codes.js'
import { pool } from './db.js'

// Что изменилось в данных семьи. Клиент по этому сигналу сам перезапрашивает нужные данные:
// в событии нет самих данных, поэтому доступ к ним по-прежнему проверяют обычные запросы.
export type RealtimeEvent =
  | { type: 'tasks' }
  | { type: 'members' }
  | { type: 'schedule'; memberId: string }
  | { type: 'trainings'; memberId: string }
  | { type: 'goals'; memberId: string }
  // события семейного календаря изменились (кто их видит, определяет сам запрос)
  | { type: 'events' }
  // в чате изменение: chat — собеседник («family» для общего чата) с точки зрения получателя
  | { type: 'chat'; chat: string }
  // игры участника: приглашение, ход, итог (кто что видит, определяет сам запрос)
  | { type: 'games' }

// Сокеты держит отдельный сервис realtime/, server с ним не связан напрямую: сигнал уходит в канал Postgres (pg_notify), сервис его
// слушает и рассылает клиентам. Контракт сообщения: contracts/realtime-v1.json (копия типов в realtime/src/contract.ts).
export const REALTIME_CHANNEL = 'realtime'

export type RealtimeMessage =
  | { v: 1; to: 'family' | 'member'; id: string; event: RealtimeEvent }
  // закрыть соединения этой сессии (id: хэш токена)
  | { v: 1; to: 'session'; id: string }

// Устройство, чей экран не освежался дольше этого, чат не смотрит (realtime освежает отметку каждым ping, раз в 30 с).
const VIEWING_FRESH_SECONDS = 90

// Сигналы уходят по одному и по порядку: у клиента от порядка ничего не зависит, но тесты и отладка читаются проще.
let queue: Promise<unknown> = Promise.resolve()

function notify(message: RealtimeMessage) {
  queue = queue
    .then(() => pool.query('select pg_notify($1, $2)', [REALTIME_CHANNEL, JSON.stringify(message)]))
    .catch((err: Error) => {
      // сигнал не критичен: клиент обновится при следующем событии или переподключении
      console.warn(JSON.stringify({ time: new Date().toISOString(), level: 'warn', source: 'server', event: 'realtime_notify_failed', error: err.message }))
    })
}

// Дожидается отправленных сигналов (остановка сервера, тесты).
export function flushRealtime() {
  return queue
}

// Рассылает событие всем подключённым участникам семьи (в том числе тому, кто его вызвал: его другие устройства тоже должны обновиться).
export function publish(familyId: string, event: RealtimeEvent) {
  notify({ v: 1, to: 'family', id: familyId, event })
}

// Событие конкретному участнику (на все его устройства): личные чаты не должны светить сигналами остальным.
export function publishTo(memberId: string, event: RealtimeEvent) {
  notify({ v: 1, to: 'member', id: memberId, event })
}

// То же по участнику: семью определяем по нему (расписания знают только id ребёнка).
export async function publishForMember(memberId: string, event: RealtimeEvent) {
  const { rows } = await pool.query('select family_id from members where id = $1', [memberId])
  if (rows[0]) publish(rows[0].family_id as string, event)
}

// После выхода с устройства его соединение закрывается.
export function closeSession(token: string) {
  notify({ v: 1, to: 'session', id: hashToken(token) })
}

// Открыт ли у участника на каком-либо устройстве этот чат (и вкладка на виду): тогда пуш о сообщении не нужен.
export async function isViewingChat(memberId: string, chat: string): Promise<boolean> {
  const { rowCount } = await pool.query(
    `select 1 from realtime_viewing where member_id = $1 and chat = $2 and updated_at > now() - make_interval(secs => $3) limit 1`,
    [memberId, chat, VIEWING_FRESH_SECONDS],
  )
  return (rowCount ?? 0) > 0
}
