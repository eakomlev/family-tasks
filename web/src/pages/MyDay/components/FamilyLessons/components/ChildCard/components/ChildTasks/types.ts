import type { TaskEntry } from '@/lib/occurrences'

// задания ребёнка для карточки родителя (группы собирает `lib/childTasks.ts: groupChildTasks`)
export interface ChildTaskList {
  // просроченные и ещё не выполненные
  overdue?: TaskEntry[]
  // вхождения на сегодня, в том числе выполненные
  today: TaskEntry[]
  // задания без срока, ещё не выполненные
  undated: TaskEntry[]
  // выполненные сегодня задания без срока или просроченные
  finished?: TaskEntry[]
}

export interface ChildTasksProps {
  // undefined — ещё грузим
  tasks: ChildTaskList | undefined
}
