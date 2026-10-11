// События с сервера: только сигнал «что изменилось», самих данных в них нет
export type ServerEvent =
  | { type: 'tasks' }
  | { type: 'members' }
  | { type: 'schedule'; memberId: string }
  | { type: 'trainings'; memberId: string }

// resync: соединение восстановилось или вкладка снова открыта, события могли быть пропущены, обновите всё
export type RealtimeEvent = ServerEvent | { type: 'resync' }

export type Topic = RealtimeEvent['type']

export type Listener = (event: RealtimeEvent) => void

export interface RealtimeContextValue {
  subscribe: (listener: Listener) => () => void
}
