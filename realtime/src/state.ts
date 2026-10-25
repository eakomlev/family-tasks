import type pg from 'pg'
import { REALTIME_CHANNEL, type RealtimeMessage } from './contract.js'

// Всё, что сервис пишет в БД: какой чат открыт на устройстве, визиты в личные чаты, метка живости.

// Ключ личного чата: id обоих участников по возрастанию (как directKey в server/src/chatKey.ts).
const directKey = (a: string, b: string) => (a < b ? `${a}:${b}` : `${b}:${a}`)

// Визиты и «был в чате» только у личных чатов: общий, чаты событий (event-…) и игры (game-…) не считаются.
const isDirectChat = (chat: string) => chat !== 'family' && !chat.startsWith('event-') && !chat.startsWith('game-')

export async function notify(pool: pg.Pool, message: RealtimeMessage) {
  await pool.query('select pg_notify($1, $2)', [REALTIME_CHANNEL, JSON.stringify(message)])
}

// Запоминает визит в личный чат (вход или выход) и даёт знать собеседнику, чтобы шапка у него обновилась.
export async function recordVisit(pool: pg.Pool, memberId: string, chat: string | null) {
  if (!chat || !isDirectChat(chat)) return
  try {
    await pool.query(
      `insert into chat_visits (member_id, chat_key, visited_at) values ($1, $2, now())
       on conflict (member_id, chat_key) do update set visited_at = excluded.visited_at`,
      [memberId, directKey(memberId, chat)],
    )
  } catch {
    return // не критично: следующий визит запишется
  }
  await notify(pool, { v: 1, to: 'member', id: chat, event: { type: 'chat', chat: memberId } }).catch(() => {})
}

// Какой чат сейчас открыт на устройстве (null: никакой). Строку освежает каждый ping, пока устройство отвечает.
export async function writeViewing(pool: pg.Pool, connectionId: string, memberId: string, chat: string | null) {
  if (chat === null) {
    await pool.query('delete from realtime_viewing where connection_id = $1', [connectionId])
    return
  }
  await pool.query(
    `insert into realtime_viewing (connection_id, member_id, chat, updated_at) values ($1, $2, $3, now())
     on conflict (connection_id) do update set chat = excluded.chat, updated_at = now()`,
    [connectionId, memberId, chat],
  )
}

export async function refreshViewing(pool: pg.Pool, connectionIds: string[]) {
  if (connectionIds.length === 0) return
  await pool.query('update realtime_viewing set updated_at = now() where connection_id = any($1)', [connectionIds])
}

export async function dropViewing(pool: pg.Pool, connectionIds: string[]) {
  if (connectionIds.length === 0) return
  await pool.query('delete from realtime_viewing where connection_id = any($1)', [connectionIds])
}

// Метка живости экземпляра и число подключений: страница «Сервис» и проверка контейнера.
export async function beat(pool: pg.Pool, instance: string, connections: number) {
  await pool.query(
    `insert into realtime_state (instance, beat_at, connections) values ($1, now(), $2)
     on conflict (instance) do update set beat_at = now(), connections = excluded.connections`,
    [instance, connections],
  )
}

export async function isAlive(pool: pg.Pool, instance: string, maxAgeSeconds: number): Promise<boolean> {
  const { rows } = await pool.query(
    'select 1 from realtime_state where instance = $1 and beat_at > now() - make_interval(secs => $2)',
    [instance, maxAgeSeconds],
  )
  return rows.length > 0
}

// Чистка: отметки устройств, которые давно не освежались (экземпляр упал), и метки давно остановленных экземпляров.
export async function housekeeping(pool: pg.Pool) {
  await pool.query(`delete from realtime_viewing where updated_at < now() - interval '5 minutes'`)
  await pool.query(`delete from realtime_state where beat_at < now() - interval '1 hour'`)
}
