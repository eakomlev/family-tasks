import type { EventInput, FamilyEvent } from '@/api'

export interface EventFormState {
  title: string
  allDay: boolean
  startDate: string
  endDate: string
  startTime: string
  endTime: string
  allFamily: boolean
  // участники кроме автора (автор видит событие всегда)
  memberIds: string[]
}

export const DEFAULT_START = '10:00'
export const DEFAULT_END = '11:00'

export const emptyEventForm = (date: string): EventFormState => ({
  title: '',
  allDay: false,
  startDate: date,
  endDate: date,
  startTime: DEFAULT_START,
  endTime: DEFAULT_END,
  allFamily: true,
  memberIds: [],
})

export function fromEvent(event: FamilyEvent, authorId: string): EventFormState {
  return {
    title: event.title,
    allDay: event.startTime === null,
    startDate: event.startDate,
    endDate: event.endDate,
    startTime: event.startTime ?? DEFAULT_START,
    endTime: event.endTime ?? DEFAULT_END,
    allFamily: event.allFamily,
    memberIds: event.memberIds.filter((id) => id !== authorId),
  }
}

export function toInput(form: EventFormState): EventInput {
  return {
    title: form.title.trim(),
    startDate: form.startDate,
    endDate: form.endDate,
    startTime: form.allDay ? null : form.startTime,
    endTime: form.allDay ? null : form.endTime,
    allFamily: form.allFamily,
    memberIds: form.allFamily ? [] : form.memberIds,
  }
}

// Текст ошибки или null, если событие можно сохранять
export function validateEvent(form: EventFormState): string | null {
  if (!form.title.trim()) return 'Введите название события.'
  if (!form.startDate || !form.endDate) return 'Укажите даты начала и окончания.'
  if (form.endDate < form.startDate) return 'Дата окончания раньше даты начала.'
  if (!form.allDay && form.startDate === form.endDate && form.endTime <= form.startTime) return 'Время окончания должно быть позже начала.'
  return null
}

// Час спустя (но не позже 23:59): конец подтягивается за началом
export function plusHour(time: string): string {
  const total = Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5)) + 60
  const capped = Math.min(total, 23 * 60 + 59)
  return `${String(Math.floor(capped / 60)).padStart(2, '0')}:${String(capped % 60).padStart(2, '0')}`
}

// Изменили начало: конец не должен оказаться раньше. Дата конца подтягивается к началу, время конца к часу после начала.
export function withStart(form: EventFormState, change: Partial<Pick<EventFormState, 'startDate' | 'startTime'>>): EventFormState {
  const next = { ...form, ...change }
  if (next.endDate < next.startDate) next.endDate = next.startDate
  if (next.startDate === next.endDate && next.endTime <= next.startTime) next.endTime = plusHour(next.startTime)
  return next
}

// Изменили конец: в тот же день время конца не раньше начала
export function withEnd(form: EventFormState, change: Partial<Pick<EventFormState, 'endDate' | 'endTime'>>): EventFormState {
  const next = { ...form, ...change }
  if (next.endDate < next.startDate) next.endDate = next.startDate
  return next
}
