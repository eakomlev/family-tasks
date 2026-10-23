// Копия чистой логики повторов из server/src/tasks/recurrence.ts (пакеты друг друга не импортируют).
export type RepeatType = 'none' | 'daily' | 'weekly' | 'monthly'

export interface Schedule {
  // YYYY-MM-DD первого вхождения
  date: string | null
  repeatType: RepeatType
  // дни недели для weekly: 1 = понедельник ... 7 = воскресенье
  repeatDays: number[]
  // YYYY-MM-DD последнего дня повтора включительно
  repeatUntil: string | null
}

const parts = (iso: string): [number, number, number] => {
  const [y, m, d] = iso.split('-').map(Number)
  return [y, m, d]
}

function isoWeekday(iso: string): number {
  const [y, m, d] = parts(iso)
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay() || 7
}

const daysInMonth = (year: number, month: number) => new Date(Date.UTC(year, month, 0)).getUTCDate()

// Бывает ли задание в этот день. Ежемесячное на 29–31 число в коротком месяце переносится на последний день.
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
