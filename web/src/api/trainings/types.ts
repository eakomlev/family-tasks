// weekday: 1 = понедельник ... 7 = воскресенье; время в формате HH:MM или null
export interface Training {
  weekday: number
  title: string
  place: string | null
  startsAt: string | null
  endsAt: string | null
}
