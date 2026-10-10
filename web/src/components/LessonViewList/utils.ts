import type { ViewLesson } from './types'

// «08:30–09:15», «с 08:30», «до 09:15» или пусто, если времени нет
export function formatTimeRange(lesson: Pick<ViewLesson, 'startsAt' | 'endsAt'>): string {
  const { startsAt, endsAt } = lesson
  if (startsAt && endsAt) return `${startsAt}–${endsAt}`
  if (startsAt) return `с ${startsAt}`
  if (endsAt) return `до ${endsAt}`
  return ''
}
