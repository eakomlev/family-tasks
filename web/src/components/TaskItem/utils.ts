import type { Member, Occurrence, Task } from '@/api'
import { coinsWord } from '@/lib/coins'
import { formatDayMonth } from '@/lib/date'
import { describeRepeat } from '@/lib/taskText'

// Что написать под названием: срок, время, повтор. Просроченное помечается.
export function taskMeta(
  task: Task,
  occurrence: Occurrence,
  today: string,
  showDate = false,
): { parts: string[]; late: boolean } {
  const parts: string[] = []
  const done = occurrence.done !== null
  // ожидающее проверки не просрочено: ребёнок своё сделал, дело за родителем
  const late = !done && occurrence.pending === null && occurrence.date !== null && occurrence.date < today

  if (late) parts.push(`Просрочено, ${formatDayMonth(occurrence.date!)}`)
  else if (showDate && occurrence.date) parts.push(formatDayMonth(occurrence.date))
  if (task.time) parts.push(task.time)
  const repeat = describeRepeat(task.repeat)
  if (repeat) parts.push(task.repeat.until ? `${repeat} до ${formatDayMonth(task.repeat.until)}` : repeat)
  // награда за выполнение: видно, что задание «стоит» монет
  if (task.reward > 0) parts.push(`+${coinsWord(task.reward)}`)
  return { parts, late }
}

const ROLE_FROM = { mama: 'от мамы', papa: 'от папы' } as const

// Подпись «от кого». Задание ребёнку от родителя подписываем по-домашнему («от мамы», «от папы»),
// во всех остальных случаях по имени автора. Пусто, если автор и есть исполнитель.
export function authorLabel(author: Member | undefined, assignee: Member | undefined): string {
  if (!author || !assignee || author.id === assignee.id) return ''
  if (assignee.role === 'child' && author.role !== 'child') return ROLE_FROM[author.role]
  return `от ${author.name}`
}
