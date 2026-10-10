import type { RepeatRule } from '@/api'
import { formatDayMonth } from './date'
import { WEEK_DAYS } from './weekdays'

// «каждый день», «по пн, ср», «раз в месяц»; пусто, если не повторяется
export function describeRepeat(repeat: RepeatRule): string {
  switch (repeat.type) {
    case 'daily':
      return 'каждый день'
    case 'weekly':
      return `по ${repeat.days.map((d) => WEEK_DAYS[d - 1].short.toLowerCase()).join(', ')}`
    case 'monthly':
      return 'раз в месяц'
    default:
      return ''
  }
}

// «12 октября в 18:00» для разовой даты; пусто, если срока нет
export function describeDue(date: string | null, time: string | null): string {
  if (!date) return ''
  return time ? `${formatDayMonth(date)} в ${time}` : formatDayMonth(date)
}
