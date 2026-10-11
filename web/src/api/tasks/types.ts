export type RepeatType = 'none' | 'daily' | 'weekly' | 'monthly'

export interface RepeatRule {
  type: RepeatType
  // дни недели для weekly: 1 = понедельник ... 7 = воскресенье
  days: number[]
  // YYYY-MM-DD последнего дня повтора или null
  until: string | null
}

export interface Task {
  id: string
  title: string
  // свободный текст, может быть пустым
  description: string
  // награда монетами за выполнение (только у заданий детей), 0 — без награды
  reward: number
  // когда создано, ISO-время
  createdAt: string
  authorId: string
  assigneeId: string
  // YYYY-MM-DD первого вхождения или null (без срока)
  date: string | null
  // HH:MM или null
  time: string | null
  repeat: RepeatRule
}

// Одно вхождение задания: у повторяющегося их много, и каждое выполняется отдельно.
export interface Occurrence {
  taskId: string
  // день вхождения, null — задание без срока
  date: string | null
  done: { memberId: string; at: string } | null
}

export interface TaskList {
  tasks: Task[]
  occurrences: Occurrence[]
}

// то, что отправляется при создании и изменении
export interface TaskInput {
  title: string
  description: string
  reward: number
  assigneeId: string
  date: string | null
  time: string | null
  repeat: { type: RepeatType; days: number[]; until: string | null }
}
