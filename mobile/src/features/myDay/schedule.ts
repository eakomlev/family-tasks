import type { Lesson, Training } from '@/api'
import { isoWeekday, WEEK_DAYS } from '@/lib/weekdays'

// Строки расписания для показа (на экране нужны только эти поля)
export interface ViewLesson {
  // для React key
  key: string
  subject: string
  startsAt?: string | null
  endsAt?: string | null
  room?: string | null
}

export interface ViewTraining {
  // для React key
  key: string
  title: string
  place?: string | null
  startsAt?: string | null
  endsAt?: string | null
}

export interface LessonDay {
  // 1 = понедельник ... 6 = суббота
  weekday: number
  // «сегодня», «завтра» или «в понедельник»
  label: string
}

export interface TrainingDay {
  // 1 = понедельник ... 7 = воскресенье
  weekday: number
  // «сегодня», «завтра», «в среду» или «через неделю»
  label: string
  trainings: ViewTraining[]
}

// «08:30–09:15», «с 08:30», «до 09:15» или пусто, если времени нет
export function formatTimeRange(item: Pick<ViewLesson, 'startsAt' | 'endsAt'>): string {
  const { startsAt, endsAt } = item
  if (startsAt && endsAt) return `${startsAt}–${endsAt}`
  if (startsAt) return `с ${startsAt}`
  if (endsAt) return `до ${endsAt}`
  return ''
}

// «1 урок», «2 урока», «5 уроков»
export function pluralLessons(count: number): string {
  const lastTwo = count % 100
  const last = count % 10
  if (lastTwo >= 11 && lastTwo <= 14) return `${count} уроков`
  if (last === 1) return `${count} урок`
  if (last >= 2 && last <= 4) return `${count} урока`
  return `${count} уроков`
}

// «08:30–10:10» от начала первого до конца последнего урока, если время указано
export function dayRange(lessons: ViewLesson[]): string | undefined {
  const starts = lessons.map((l) => l.startsAt).filter((t): t is string => !!t)
  const ends = lessons.map((l) => l.endsAt).filter((t): t is string => !!t)
  if (starts.length === 0 || ends.length === 0) return undefined
  return `${starts.reduce((a, b) => (a < b ? a : b))}–${ends.reduce((a, b) => (a > b ? a : b))}`
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
