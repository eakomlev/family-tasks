export interface LocalTime {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  // 0 = воскресенье ... 6 = суббота
  weekday: number
  // YYYY-MM-DD
  date: string
}

// Окно, в которое уведомление ещё можно отправить после назначенного времени (если сервер был недоступен).
// Позже окна уведомление уже не нужно: оно потеряло смысл.
export const SLOTS = {
  birthday: { hour: 10, windowMinutes: 120 },
  lessons: { hour: 17, windowMinutes: 120 },
}

// За сколько до начала тренировки напоминать и сколько после этого момента ещё можно отправить
// (запас на случай, если сервер на минуту-другую был недоступен; позже уже не «за 2 часа»).
export const TRAINING_LEAD_MINUTES = 120
export const TRAINING_WINDOW_MINUTES = 15

export type Slot = { hour: number; windowMinutes: number }

export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone })
    return true
  } catch {
    return false
  }
}

// Какое сейчас время и дата в часовом поясе устройства (выбросит RangeError, если пояс неизвестен).
export function localTime(at: Date, timeZone: string): LocalTime {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(at)
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value)

  const year = get('year')
  const month = get('month')
  const day = get('day')
  return {
    year,
    month,
    day,
    hour: get('hour'),
    minute: get('minute'),
    // день недели локальной даты, не зависящий от пояса сервера
    weekday: new Date(Date.UTC(year, month - 1, day)).getUTCDay(),
    date: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
  }
}

export function isDue(local: LocalTime, slot: Slot): boolean {
  const minutes = local.hour * 60 + local.minute
  const start = slot.hour * 60
  return minutes >= start && minutes < start + slot.windowMinutes
}

// YYYY-MM-DD плюс days дней (календарная арифметика, без часовых поясов)
export function addDays(date: string, days: number): string {
  const [year, month, day] = date.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10)
}
