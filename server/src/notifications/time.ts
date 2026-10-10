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

export type Slot = (typeof SLOTS)[keyof typeof SLOTS]

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
