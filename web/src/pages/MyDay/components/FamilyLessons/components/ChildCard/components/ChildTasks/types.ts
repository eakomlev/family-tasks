import type { TaskEntry } from '@/lib/occurrences'

// задания ребёнка для карточки родителя
export interface ChildTaskList {
  // вхождения на сегодня, в том числе выполненные
  today: TaskEntry[]
  // задания без срока (выполненные сервер в список не отдаёт)
  undated: TaskEntry[]
}

export interface ChildTasksProps {
  // undefined — ещё грузим
  tasks: ChildTaskList | undefined
}
