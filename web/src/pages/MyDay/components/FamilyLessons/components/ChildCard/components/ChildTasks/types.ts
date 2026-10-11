import type { TaskEntry } from '@/lib/occurrences'

export interface ChildTasksProps {
  // задания ребёнка на сегодня, в том числе выполненные; undefined — ещё грузим
  entries: TaskEntry[] | undefined
}
