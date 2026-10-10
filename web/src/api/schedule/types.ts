// weekday: 1 = понедельник ... 6 = суббота; время в формате HH:MM или null
export interface Lesson {
  weekday: number
  subject: string
  startsAt: string | null
  endsAt: string | null
}
