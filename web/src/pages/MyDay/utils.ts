import type { Lesson, Training } from '@/api'
import type { ViewLesson } from '@/components/LessonViewList/types'
import type { ViewTraining } from '@/components/TrainingViewList/types'
import { isoWeekday, WEEK_DAYS } from '@/lib/weekdays'
import type { Greeting, LessonDay, TrainingDay } from './types'

export function getGreeting(date: Date): Greeting {
  const hour = date.getHours()
  if (hour >= 5 && hour < 12) return { text: 'Доброе утро', icon: '🌅' }
  if (hour >= 12 && hour < 18) return { text: 'Добрый день', icon: '☀️' }
  if (hour >= 18 && hour < 23) return { text: 'Добрый вечер', icon: '🌇' }
  return { text: 'Доброй ночи', icon: '🌙' }
}

// «Суббота, 10 октября»
export function formatToday(date: Date): string {
  const text = date.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' })
  return text.charAt(0).toUpperCase() + text.slice(1)
}

// с этого часа считаем, что сегодняшние уроки уже закончились, и показываем следующий день
// (так же начинается «Добрый вечер» в приветствии)
export const EVENING_HOUR = 18

const WEEKDAYS_ACCUSATIVE = ['в воскресенье', 'в понедельник', 'во вторник', 'в среду', 'в четверг', 'в пятницу', 'в субботу']

const addDays = (date: Date, days: number) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + days)

// Начало местного дня (полночь) как ISO-время: с него считаются монеты, заработанные сегодня.
export const startOfDayIso = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate()).toISOString()

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
    .map((l, index) => ({ key: `${weekday}-${index}`, subject: l.subject, startsAt: l.startsAt, endsAt: l.endsAt, room: l.room }))
}

// Какие тренировки показывать: до вечера сегодняшние, вечером (как с уроками) завтрашние.
// Тренировки бывают не каждый день, поэтому берём ближайший день, в который они есть, и подписываем его:
// «сегодня», «завтра», «в среду». null, если тренировок нет вообще.
export function pickTrainingDay(now: Date, trainings: Training[]): TrainingDay | null {
  const start = now.getHours() >= EVENING_HOUR ? 1 : 0
  for (let offset = start; offset < start + 7; offset++) {
    const weekday = ((isoWeekday(now) - 1 + offset) % 7) + 1
    const dayTrainings = trainings.filter((t) => t.weekday === weekday)
    if (dayTrainings.length === 0) continue

    const label =
      offset === 0 ? 'сегодня' : offset === 1 ? 'завтра' : offset === 7 ? 'через неделю' : WEEK_DAYS[weekday - 1].inDay
    return {
      weekday,
      label,
      trainings: dayTrainings.map(
        (t, index): ViewTraining => ({
          key: `${weekday}-${index}`,
          title: t.title,
          place: t.place,
          startsAt: t.startsAt,
          endsAt: t.endsAt,
        }),
      ),
    }
  }
  return null
}

// «Плавание 18:00 · Растяжка»: коротко для карточки ребёнка
export function trainingSummary(day: TrainingDay): string {
  return day.trainings.map((t) => (t.startsAt ? `${t.title} ${t.startsAt}` : t.title)).join(' · ')
}
