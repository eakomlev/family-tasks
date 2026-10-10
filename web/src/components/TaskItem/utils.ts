import type { Occurrence, Task } from '@/api'
import { formatDayMonth } from '@/lib/date'
import { describeRepeat } from '@/lib/taskText'

// Что написать под названием: срок, время, повтор. Просроченное помечается.
export function taskMeta(task: Task, occurrence: Occurrence, today: string): { parts: string[]; late: boolean } {
  const parts: string[] = []
  const done = occurrence.done !== null
  const late = !done && occurrence.date !== null && occurrence.date < today

  if (late) parts.push(`Просрочено, ${formatDayMonth(occurrence.date!)}`)
  if (task.time) parts.push(task.time)
  const repeat = describeRepeat(task.repeat)
  if (repeat) parts.push(repeat)
  return { parts, late }
}
