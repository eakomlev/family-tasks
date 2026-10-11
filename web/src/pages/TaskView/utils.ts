import type { Occurrence, Task } from '@/api'
import { describeDue, describeRepeat } from '@/lib/taskText'
import { formatDayMonth } from '@/lib/date'

// Срок вхождения: «12 октября в 18:00» или «без срока».
export function describeOccurrenceDue(task: Task, occurrence: Occurrence | null): string {
  const date = occurrence ? occurrence.date : task.date
  return describeDue(date, task.time) || 'без срока'
}

// «каждый день до 1 декабря»; пусто, если не повторяется
export function describeFullRepeat(task: Task): string {
  const repeat = describeRepeat(task.repeat)
  if (!repeat) return ''
  return task.repeat.until ? `${repeat} до ${formatDayMonth(task.repeat.until)}` : repeat
}
