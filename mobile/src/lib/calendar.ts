import type { FamilyEvent, Member, TaskList, Training } from '@/api'
import { addDays, isoWeekdayOf } from '@/lib/date'
import type { CalendarKind, CalendarSettings, CalendarView } from './calendarSettings'
import { holidayOn } from './holidays'
import { memberLabel, type Role } from './roles'

// Запись семейного календаря на конкретный день: событие, задание, день рождения, тренировка или праздник.
export interface CalendarItem {
  key: string
  kind: CalendarKind
  title: string
  subtitle?: string
  // день, в который запись показана (YYYY-MM-DD); у многодневного события по записи на каждый день
  date: string
  // HH:MM; обе null: на весь день
  start: string | null
  end: string | null
  // чьи это записи (для фильтра «кто виден»); пусто: общее (праздник, событие для всей семьи)
  memberIds: string[]
  // куда ведёт нажатие или null
  href: string | null
  done?: boolean
}

// ---- даты (строки YYYY-MM-DD, без часовых поясов) ----

export const startOfWeek = (iso: string) => addDays(iso, 1 - isoWeekdayOf(iso))
export const endOfWeek = (iso: string) => addDays(startOfWeek(iso), 6)
export const startOfMonth = (iso: string) => `${iso.slice(0, 8)}01`

export function endOfMonth(iso: string): string {
  const year = Number(iso.slice(0, 4))
  const month = Number(iso.slice(5, 7))
  return new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10)
}

// все дни от from до to включительно
export function eachDay(from: string, to: string): string[] {
  const days: string[] = []
  for (let day = from; day <= to; day = addDays(day, 1)) days.push(day)
  return days
}

// Период для загрузки данных: месяц показывается сеткой целых недель (до 6), неделя и день как есть
export function rangeFor(view: CalendarView, anchor: string): { from: string; to: string } {
  if (view === 'day') return { from: anchor, to: anchor }
  if (view === 'week') return { from: startOfWeek(anchor), to: endOfWeek(anchor) }
  return { from: startOfWeek(startOfMonth(anchor)), to: endOfWeek(endOfMonth(anchor)) }
}

// Шаг вперёд или назад: день, неделя или месяц (в коротком месяце число сдвигается на последний день)
export function shiftAnchor(view: CalendarView, anchor: string, direction: 1 | -1): string {
  if (view === 'day') return addDays(anchor, direction)
  if (view === 'week') return addDays(anchor, 7 * direction)
  const year = Number(anchor.slice(0, 4))
  const month = Number(anchor.slice(5, 7)) - 1 + direction
  const first = new Date(Date.UTC(year, month, 1))
  const last = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
  const day = Math.min(Number(anchor.slice(8, 10)), last)
  return new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), day)).toISOString().slice(0, 10)
}

const local = (iso: string) => new Date(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)))
const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1)

// Заголовок периода: «Ноябрь 2026», «9–15 ноября», «Суббота, 7 ноября»
export function formatPeriod(view: CalendarView, anchor: string): string {
  if (view === 'month') return capitalize(local(anchor).toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' }).replace(/\s*г\.$/, ''))
  if (view === 'day') return capitalize(local(anchor).toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' }))
  const from = startOfWeek(anchor)
  const to = endOfWeek(anchor)
  const sameMonth = from.slice(0, 7) === to.slice(0, 7)
  const fromText = local(from).toLocaleDateString('ru-RU', sameMonth ? { day: 'numeric' } : { day: 'numeric', month: 'short' })
  const toText = local(to).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })
  return `${fromText.replace('.', '')}–${toText}`
}

// «Пн, 9 ноября» для заголовков дней недели
export function formatDayHeading(iso: string): string {
  return capitalize(local(iso).toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric', month: 'long' }))
}

// ---- сбор записей ----

const within = (day: string, from: string, to: string) => day >= from && day <= to

export function eventItems(events: FamilyEvent[], from: string, to: string): CalendarItem[] {
  const items: CalendarItem[] = []
  for (const event of events) {
    for (const day of eachDay(event.startDate > from ? event.startDate : from, event.endDate < to ? event.endDate : to)) {
      const single = event.startDate === event.endDate
      items.push({
        key: `event:${event.id}:${day}`,
        kind: 'event',
        title: event.title,
        date: day,
        // многодневное: в первый день только начало, в последний только конец, между ними весь день
        start: single || day === event.startDate ? event.startTime : null,
        end: single || day === event.endDate ? event.endTime : null,
        // событие для всей семьи не привязано к человеку; остальные к автору и участникам
        memberIds: event.allFamily ? [] : [...new Set([event.authorId, ...event.memberIds])],
        href: `/calendar/events/${event.id}`,
      })
    }
  }
  return items
}

// Подпись задания в календаре: исполнитель (ребёнок видит родителей как «Мама» и «Папа»)
function assigneeSubtitle(members: Member[], assigneeId: string, viewerRole: Role): string | undefined {
  const assignee = members.find((m) => m.id === assigneeId)
  return assignee ? `Исполнитель: ${memberLabel(assignee, viewerRole)}` : undefined
}

// Задания периода
export function taskItems(list: TaskList | undefined, from: string, to: string, members: Member[] = [], viewerRole: Role = 'child'): CalendarItem[] {
  if (!list) return []
  const byId = new Map(list.tasks.map((task) => [task.id, task]))
  const items: CalendarItem[] = []
  for (const occurrence of list.occurrences) {
    const task = byId.get(occurrence.taskId)
    if (!task || occurrence.date === null || !within(occurrence.date, from, to)) continue
    items.push({
      key: `task:${task.id}:${occurrence.date}`,
      kind: 'task',
      title: task.title,
      subtitle: assigneeSubtitle(members, task.assigneeId, viewerRole),
      date: occurrence.date,
      start: task.time,
      end: null,
      memberIds: [task.assigneeId],
      href: `/tasks/${task.id}?date=${occurrence.date}`,
      done: occurrence.done !== null,
    })
  }
  return items
}

// Дни рождения: в период попадает каждый год в день рождения (29 февраля в невисокосный год отмечается 28-го)
export function birthdayItems(members: Member[], from: string, to: string, viewerRole: Role): CalendarItem[] {
  const items: CalendarItem[] = []
  const years = new Set([Number(from.slice(0, 4)), Number(to.slice(0, 4))])
  for (const member of members) {
    if (!member.birthDate) continue
    const birthYear = Number(member.birthDate.slice(0, 4))
    const monthDay = member.birthDate.slice(5)
    for (const year of years) {
      const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
      const day = `${year}-${monthDay === '02-29' && !leap ? '02-28' : monthDay}`
      if (year <= birthYear || !within(day, from, to)) continue
      items.push({
        key: `birthday:${member.id}:${day}`,
        kind: 'birthday',
        title: `День рождения: ${memberLabel(member, viewerRole)}`,
        subtitle: `Исполняется ${year - birthYear}`,
        date: day,
        start: null,
        end: null,
        memberIds: [member.id],
        href: `/family/${member.id}`,
      })
    }
  }
  return items
}

// Тренировки детей: повторяются каждую неделю в свой день; у ребёнка ссылка на его расписание, у взрослого на расписание ребёнка
export function trainingItems(
  byChild: Record<string, Training[] | undefined>,
  members: Member[],
  from: string,
  to: string,
  viewerId: string,
): CalendarItem[] {
  const items: CalendarItem[] = []
  for (const [childId, trainings] of Object.entries(byChild)) {
    if (!trainings?.length) continue
    const child = members.find((m) => m.id === childId)
    for (const day of eachDay(from, to)) {
      const weekday = isoWeekdayOf(day)
      trainings.forEach((training, index) => {
        if (training.weekday !== weekday) return
        items.push({
          key: `training:${childId}:${day}:${index}`,
          kind: 'training',
          title: training.title,
          subtitle: [child && childId !== viewerId ? child.name : null, training.place].filter(Boolean).join(' · ') || undefined,
          date: day,
          start: training.startsAt,
          end: training.endsAt,
          memberIds: [childId],
          href: childId === viewerId ? '/profile/trainings' : `/family/${childId}/trainings`,
        })
      })
    }
  }
  return items
}

export function holidayItems(from: string, to: string): CalendarItem[] {
  const items: CalendarItem[] = []
  for (const day of eachDay(from, to)) {
    const title = holidayOn(day)
    if (title) items.push({ key: `holiday:${day}`, kind: 'holiday', title, date: day, start: null, end: null, memberIds: [], href: null })
  }
  return items
}

// ---- фильтр по настройкам, порядок, подписи ----

// Показываем запись, если её вид включён и она общая либо хотя бы один её человек не скрыт
export function visibleItems(items: CalendarItem[], settings: CalendarSettings): CalendarItem[] {
  return items.filter(
    (item) => settings.kinds[item.kind] && (item.memberIds.length === 0 || item.memberIds.some((id) => !settings.hiddenMembers.includes(id))),
  )
}

const KIND_ORDER: Record<CalendarKind, number> = { holiday: 0, birthday: 1, event: 2, training: 3, task: 4 }

// На весь день сверху (праздники, дни рождения, события), дальше по времени начала
export function compareItems(a: CalendarItem, b: CalendarItem): number {
  if (a.start === null && b.start !== null) return -1
  if (a.start !== null && b.start === null) return 1
  if (a.start !== b.start) return a.start! < b.start! ? -1 : 1
  return KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || a.title.localeCompare(b.title, 'ru')
}

export function groupByDay(items: CalendarItem[]): Map<string, CalendarItem[]> {
  const map = new Map<string, CalendarItem[]>()
  for (const item of [...items].sort((x, y) => (x.date < y.date ? -1 : x.date > y.date ? 1 : compareItems(x, y)))) map.set(item.date, [...(map.get(item.date) ?? []), item])
  return map
}

// «10:00–11:30», «с 10:00», «до 11:30» или «Весь день»
export function timeLabel(item: Pick<CalendarItem, 'start' | 'end'>): string {
  if (item.start && item.end) return `${item.start}–${item.end}`
  if (item.start) return `с ${item.start}`
  if (item.end) return `до ${item.end}`
  return 'Весь день'
}

// ---- вид «День»: полоса суток с блоками ----

export const MINUTES_IN_DAY = 24 * 60
// короче этого блок не рисуется (иначе подпись не помещается, а соседи по времени накладывались бы незаметно)
export const MIN_BLOCK_MINUTES = 30

const toMinutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5))

// Запись без времени (весь день): праздники, дни рождения, события на весь день и середина многодневного
export const isAllDay = (item: Pick<CalendarItem, 'start' | 'end'>) => item.start === null && item.end === null

// Запись на полосе суток: сколько минут от полуночи занимает и в какой «колонке» стоит рядом с пересекающимися
export interface PlacedItem {
  item: CalendarItem
  startMin: number
  endMin: number
  // номер колонки среди пересекающихся записей и сколько их всего в этой группе
  column: number
  columns: number
}

// Сколько длится запись, у которой нет конца: событие, начавшееся в этот день и идущее дальше, до конца суток; задание полчаса;
// тренировка без конца час
function endOf(item: CalendarItem, start: number): number {
  if (item.end) return toMinutes(item.end)
  if (item.kind === 'event') return MINUTES_IN_DAY
  return start + (item.kind === 'task' ? MIN_BLOCK_MINUTES : 60)
}

// Раскладывает записи со временем по полосе суток. Пересекающиеся делят ширину поровну: каждая получает свою колонку, как в Teams.
export function placeTimed(items: CalendarItem[]): PlacedItem[] {
  const timed = items
    .filter((item) => !isAllDay(item))
    .map((item) => {
      // последний день многодневного события: есть только конец, значит с полуночи
      const start = item.start ? toMinutes(item.start) : 0
      const end = Math.min(MINUTES_IN_DAY, Math.max(endOf(item, start), start + MIN_BLOCK_MINUTES))
      return { item, startMin: start, endMin: end }
    })
    .sort((a, b) => a.startMin - b.startMin || b.endMin - a.endMin)

  const placed: PlacedItem[] = []
  let group: { item: CalendarItem; startMin: number; endMin: number; column: number }[] = []
  let groupEnd = 0
  let columnEnds: number[] = []

  const flush = () => {
    for (const entry of group) placed.push({ ...entry, columns: columnEnds.length })
    group = []
    columnEnds = []
  }

  for (const entry of timed) {
    if (group.length > 0 && entry.startMin >= groupEnd) flush()
    let column = columnEnds.findIndex((end) => end <= entry.startMin)
    if (column === -1) column = columnEnds.length
    columnEnds[column] = entry.endMin
    group.push({ ...entry, column })
    groupEnd = Math.max(groupEnd, entry.endMin)
  }
  flush()
  return placed
}
