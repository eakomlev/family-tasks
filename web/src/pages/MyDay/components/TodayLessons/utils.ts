import type { Lesson } from '@/api'
import type { ViewLesson } from '@/components/LessonViewList/types'
import type { LessonDay } from './types'

// с этого часа считаем, что сегодняшние уроки уже закончились, и показываем следующий день
// (так же начинается «Добрый вечер» в приветствии)
export const EVENING_HOUR = 18

const WEEKDAYS_ACCUSATIVE = ['в воскресенье', 'в понедельник', 'во вторник', 'в среду', 'в четверг', 'в пятницу', 'в субботу']

const addDays = (date: Date, days: number) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + days)

export const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1)

// Выбирает, чьи уроки показывать:
//  - до вечера сегодняшние, вечером завтрашние;
//  - воскресенье и суббота без уроков пропускаются, дальше идёт понедельник.
export function pickLessonDay(now: Date, lessons: Lesson[]): LessonDay {
  const today = addDays(now, 0)
  const hasLessons = (date: Date) => lessons.some((l) => l.weekday === date.getDay())

  let target = now.getHours() >= EVENING_HOUR ? addDays(today, 1) : today
  while (target.getDay() === 0 || (target.getDay() === 6 && !hasLessons(target))) {
    target = addDays(target, 1)
  }

  const diff = Math.round((target.getTime() - today.getTime()) / 86_400_000)
  const label = diff === 0 ? 'сегодня' : diff === 1 ? 'завтра' : WEEKDAYS_ACCUSATIVE[target.getDay()]
  return { weekday: target.getDay(), label }
}

export function lessonsForDay(lessons: Lesson[], weekday: number): ViewLesson[] {
  return lessons
    .filter((l) => l.weekday === weekday)
    .map((l, index) => ({ key: `${weekday}-${index}`, subject: l.subject, startsAt: l.startsAt, endsAt: l.endsAt }))
}
