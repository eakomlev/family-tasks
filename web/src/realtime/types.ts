// События с сервера: только сигнал «что изменилось», самих данных в них нет
export type ServerEvent =
  | { type: 'tasks' }
  | { type: 'members' }
  | { type: 'schedule'; memberId: string }
  | { type: 'trainings'; memberId: string }
  // цели ребёнка: создали, изменили, удалили или купили
  | { type: 'goals'; memberId: string }
  // события семейного календаря изменились
  | { type: 'events' }
  // изменение в чате; chat — «family» или собеседник
  | { type: 'chat'; chat: string }
  // игры: приглашение, ход или итог
  | { type: 'games' }

// resync: соединение восстановилось или вкладка снова открыта, события могли быть пропущены, обновите всё
export type RealtimeEvent = ServerEvent | { type: 'resync' }

export type Topic = RealtimeEvent['type']

export type Listener = (event: RealtimeEvent) => void

export interface RealtimeContextValue {
  subscribe: (listener: Listener) => () => void
  // какой чат открыт на экране (null — никакой): сервер не шлёт пуши о сообщениях в открытом чате
  setViewing: (chat: string | null) => void
}
