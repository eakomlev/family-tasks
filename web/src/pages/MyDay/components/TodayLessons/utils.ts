import type { Lesson } from '@/api'
import type { ViewLesson } from '@/components/LessonViewList/types'

// 1 = понедельник ... 6 = суббота; в воскресенье уроков не бывает, поэтому null
export const scheduleWeekday = (date: Date): number | null => (date.getDay() === 0 ? null : date.getDay())

export function lessonsForDay(lessons: Lesson[], weekday: number | null): ViewLesson[] {
  if (weekday === null) return []
  return lessons
    .filter((l) => l.weekday === weekday)
    .map((l, index) => ({ key: `${weekday}-${index}`, subject: l.subject, startsAt: l.startsAt, endsAt: l.endsAt }))
}
