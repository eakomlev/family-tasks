import type { Lesson } from '@/api'
import type { Days, LessonDraft } from './types'

export const WEEKDAYS = [
  { value: 1, short: 'Пн', full: 'Понедельник' },
  { value: 2, short: 'Вт', full: 'Вторник' },
  { value: 3, short: 'Ср', full: 'Среда' },
  { value: 4, short: 'Чт', full: 'Четверг' },
  { value: 5, short: 'Пт', full: 'Пятница' },
  { value: 6, short: 'Сб', full: 'Суббота' },
]

export const MAX_LESSONS_PER_DAY = 12

let seq = 0
// не crypto.randomUUID: он недоступен на страницах без HTTPS
const newKey = () => `lesson-${++seq}`

export const newLesson = (): LessonDraft => ({ key: newKey(), subject: '', startsAt: '', endsAt: '' })

export function fromLessons(lessons: Lesson[]): Days {
  const days: Days = {}
  for (const { value } of WEEKDAYS) days[value] = []
  for (const lesson of lessons) {
    days[lesson.weekday]?.push({
      key: newKey(),
      subject: lesson.subject,
      startsAt: lesson.startsAt ?? '',
      endsAt: lesson.endsAt ?? '',
    })
  }
  return days
}

// строки без предмета считаем пустыми заготовками и не сохраняем
export function toLessons(days: Days): Lesson[] {
  return WEEKDAYS.flatMap(({ value }) =>
    (days[value] ?? [])
      .filter((l) => l.subject.trim().length > 0)
      .map((l) => ({
        weekday: value,
        subject: l.subject.trim(),
        startsAt: l.startsAt || null,
        endsAt: l.endsAt || null,
      })),
  )
}

export const hasInvalidTime = (days: Days) =>
  Object.values(days).some((list) =>
    list.some((l) => l.subject.trim() && l.startsAt && l.endsAt && l.endsAt <= l.startsAt),
  )

// день по умолчанию: сегодняшний, а в воскресенье понедельник
export function defaultDay(date = new Date()): number {
  const day = date.getDay()
  return day === 0 ? 1 : day
}
