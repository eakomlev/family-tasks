// Что изменилось в данных семьи (копия типа из server/src/realtime.ts; общий образец contracts/realtime-v1.json проверяют тесты обоих пакетов).
export type RealtimeEvent =
  | { type: 'tasks' }
  | { type: 'members' }
  | { type: 'schedule'; memberId: string }
  | { type: 'trainings'; memberId: string }
  | { type: 'goals'; memberId: string }
  | { type: 'events' }
  | { type: 'chat'; chat: string }
  | { type: 'games' }

// Сообщение канала Postgres «realtime»: server пишет, этот сервис слушает.
export const REALTIME_CHANNEL = 'realtime'

export type RealtimeMessage =
  | { v: 1; to: 'family' | 'member'; id: string; event: RealtimeEvent }
  // закрыть соединения этой сессии (id: хэш токена)
  | { v: 1; to: 'session'; id: string }

// Разбор присланного: всё непонятное (в том числе версия новее) пропускаем, а не падаем.
export function parseMessage(raw: string | undefined): RealtimeMessage | null {
  if (!raw) return null
  let value: unknown
  try {
    value = JSON.parse(raw)
  } catch {
    return null
  }
  if (typeof value !== 'object' || value === null) return null
  const m = value as { v?: unknown; to?: unknown; id?: unknown; event?: unknown }
  if (m.v !== 1 || typeof m.id !== 'string' || m.id === '') return null
  if (m.to === 'session') return { v: 1, to: 'session', id: m.id }
  if (m.to === 'family' || m.to === 'member') {
    const event = m.event as { type?: unknown } | null
    if (typeof event !== 'object' || event === null || typeof event.type !== 'string') return null
    return { v: 1, to: m.to, id: m.id, event: event as RealtimeEvent }
  }
  return null
}
