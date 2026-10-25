export type Level = 'info' | 'warn' | 'error'
export type Log = (level: Level, event: string, data?: Record<string, unknown>) => void

// Строка JSON в стандартный вывод контейнера, как у server. Успешные отправки не пишем: только то, что требует внимания.
export const log: Log = (level, event, data = {}) => {
  console.log(JSON.stringify({ time: new Date().toISOString(), level, source: 'realtime', event, ...data }))
}
