import type { TaskList } from '@/api'
import { todayIso } from '@/lib/date'
import { byTimeThenTitle, toEntries, type TaskEntry } from '@/lib/occurrences'

// Задания одного ребёнка для сводки родителя на «Моём дне»: все, а не только сегодняшние со временем.
export interface ChildTaskGroups {
  // просроченные и ещё не выполненные (или ждущие проверки): самое важное, идут первыми
  overdue: TaskEntry[]
  // вхождения на сегодня (со временем и без), в том числе выполненные
  today: TaskEntry[]
  // задания без срока, ещё не выполненные
  undated: TaskEntry[]
  // выполненные именно сегодня, у которых срока нет или он был раньше (из списка выполненного: основной список сервер для них не отдаёт)
  finished: TaskEntry[]
}

const key = ({ task, occurrence }: TaskEntry) => `${task.id}|${occurrence.date ?? 'none'}`

// Раскладывает задания ребёнка по группам. current это список за сегодня (`GET /api/tasks?from=today&to=today`), recentDone недавно
// выполненное (`GET /api/tasks/done`); пока основной список не пришёл, возвращает undefined.
export function groupChildTasks(current: TaskList | undefined, recentDone: TaskList | undefined, childId: string, today: string): ChildTaskGroups | undefined {
  if (!current) return undefined
  const entries = toEntries(current, childId)
  const byDateThenTime = (a: TaskEntry, b: TaskEntry) => (a.occurrence.date ?? '').localeCompare(b.occurrence.date ?? '') || byTimeThenTitle(a, b)

  const seen = new Set(entries.map(key))
  const finished = recentDone
    ? toEntries(recentDone, childId)
        .filter((e) => e.occurrence.done !== null && todayIso(new Date(e.occurrence.done.at)) === today && (e.occurrence.date === null || e.occurrence.date < today))
        .filter((e) => !seen.has(key(e)))
        // свежие выполненные сверху
        .sort((a, b) => (b.occurrence.done?.at ?? '').localeCompare(a.occurrence.done?.at ?? ''))
    : []

  return {
    overdue: entries.filter(({ occurrence }) => occurrence.date !== null && occurrence.date < today).sort(byDateThenTime),
    today: entries.filter(({ occurrence }) => occurrence.date === today).sort(byTimeThenTitle),
    undated: entries.filter(({ occurrence }) => occurrence.date === null).sort(byTimeThenTitle),
    finished,
  }
}
