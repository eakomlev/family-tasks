import type { TaskList } from '@/api'
import { formatDayHeading } from '@/lib/date'
import { byTimeThenTitle, toEntries, type TaskEntry } from '@/lib/occurrences'
import type { Section } from './types'

// Предстоящие: просроченное, затем по дням, затем «без срока».
export function buildSections(list: TaskList, today: string, assigneeId: string | null): Section[] {
  const entries = toEntries(list, assigneeId)
  const overdue: TaskEntry[] = []
  const undated: TaskEntry[] = []
  const byDate = new Map<string, TaskEntry[]>()

  for (const entry of entries) {
    const { date, done } = entry.occurrence
    if (date === null) undated.push(entry)
    else if (date < today && !done) overdue.push(entry)
    else byDate.set(date, [...(byDate.get(date) ?? []), entry])
  }

  const sections: Section[] = []
  if (overdue.length) sections.push({ key: 'overdue', title: 'Просрочено', items: overdue.sort(byTimeThenTitle) })
  for (const date of [...byDate.keys()].sort()) {
    sections.push({ key: date, title: formatDayHeading(date, today), items: byDate.get(date)!.sort(byTimeThenTitle) })
  }
  if (undated.length) sections.push({ key: 'undated', title: 'Без срока', items: undated.sort(byTimeThenTitle) })
  return sections
}

// Выполненные: в том порядке, как пришли с сервера (свежие сверху).
export const buildDone = (list: TaskList, assigneeId: string | null): TaskEntry[] => toEntries(list, assigneeId)
