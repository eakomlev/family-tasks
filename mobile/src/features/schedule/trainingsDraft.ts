import type { Training } from '@/api'
import { isoWeekday, WEEK_DAYS } from '@/lib/weekdays'
import type { Days, TrainingDraft } from './trainingsTypes'

export const MAX_TRAININGS_PER_DAY = 8

let seq = 0
// не crypto.randomUUID: он недоступен на страницах без HTTPS
const newKey = () => `training-${++seq}`

export const newTraining = (): TrainingDraft => ({ key: newKey(), title: '', place: '', startsAt: '', endsAt: '' })

export function fromTrainings(trainings: Training[]): Days {
  const days: Days = {}
  for (const { value } of WEEK_DAYS) days[value] = []
  for (const training of trainings) {
    days[training.weekday]?.push({
      key: newKey(),
      title: training.title,
      place: training.place ?? '',
      startsAt: training.startsAt ?? '',
      endsAt: training.endsAt ?? '',
    })
  }
  return days
}

// строки без названия считаем пустыми заготовками и не сохраняем
export function toTrainings(days: Days): Training[] {
  return WEEK_DAYS.flatMap(({ value }) =>
    (days[value] ?? [])
      .filter((t) => t.title.trim().length > 0)
      .map((t) => ({
        weekday: value,
        title: t.title.trim(),
        place: t.place.trim() || null,
        startsAt: t.startsAt || null,
        endsAt: t.endsAt || null,
      })),
  )
}

export const hasInvalidTime = (days: Days) =>
  Object.values(days).some((list) =>
    list.some((t) => t.title.trim() && t.startsAt && t.endsAt && t.endsAt <= t.startsAt),
  )

// день по умолчанию: сегодняшний
export const defaultDay = (date = new Date()) => isoWeekday(date)
