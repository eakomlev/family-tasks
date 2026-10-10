export type RepeatType = 'none' | 'daily' | 'weekly' | 'monthly'

// Всё, что определяет, в какие дни задание происходит.
export interface Schedule {
  // YYYY-MM-DD первого вхождения; null — задание без срока
  date: string | null
  repeatType: RepeatType
  // дни недели для weekly: 1 = понедельник ... 7 = воскресенье
  repeatDays: number[]
  // YYYY-MM-DD последнего дня повтора включительно
  repeatUntil: string | null
}

// В таблице отметок у задания без даты вместо даты стоит это значение.
export const NO_DATE = '1970-01-01'

const parts = (iso: string): [number, number, number] => {
  const [y, m, d] = iso.split('-').map(Number)
  return [y, m, d]
}

export function addDays(iso: string, days: number): string {
  const [y, m, d] = parts(iso)
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10)
}

// день недели в формате ISO: 1 = понедельник ... 7 = воскресенье
export function isoWeekday(iso: string): number {
  const [y, m, d] = parts(iso)
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay() || 7
}

const daysInMonth = (year: number, month: number) => new Date(Date.UTC(year, month, 0)).getUTCDate()

// Реальная дата в формате YYYY-MM-DD (отсекает 30 февраля, 13-й месяц и т. п.).
export function isRealDate(iso: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false
  const [y, m, d] = parts(iso)
  const date = new Date(Date.UTC(y, m - 1, d))
  return date.toISOString().slice(0, 10) === iso
}

// Бывает ли задание в этот день. Ежемесячное задание на 29–31 число в коротком месяце переносится на последний день.
export function occursOn(schedule: Schedule, day: string): boolean {
  const { date, repeatType, repeatDays, repeatUntil } = schedule
  if (date === null || day < date) return false
  if (repeatUntil !== null && day > repeatUntil) return false

  switch (repeatType) {
    case 'none':
      return day === date
    case 'daily':
      return true
    case 'weekly':
      return repeatDays.includes(isoWeekday(day))
    case 'monthly': {
      const [, , startDay] = parts(date)
      const [y, m, d] = parts(day)
      return d === Math.min(startDay, daysInMonth(y, m))
    }
  }
}

// Дни с from по to включительно, в которые есть задание (по возрастанию).
export function occurrencesBetween(schedule: Schedule, from: string, to: string): string[] {
  if (schedule.date === null) return []
  const result: string[] = []
  const start = from > schedule.date ? from : schedule.date
  const end = schedule.repeatUntil !== null && schedule.repeatUntil < to ? schedule.repeatUntil : to
  for (let day = start; day <= end; day = addDays(day, 1)) {
    if (occursOn(schedule, day)) result.push(day)
  }
  return result
}
