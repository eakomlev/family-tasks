// Даты рождения хранятся строкой YYYY-MM-DD. Разбираем её вручную, а не через new Date(str):
// тот трактует строку как UTC и в части часовых поясов сдвигает день.
function parts(iso: string): [number, number, number] {
  const [year, month, day] = iso.split('-').map(Number)
  return [year, month, day]
}

// «12 мая 1985»
export function formatBirthDate(iso: string): string {
  const [year, month, day] = parts(iso)
  return new Date(year, month - 1, day)
    .toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
    .replace(/\s*г\.$/, '')
}

export function ageFromBirthDate(iso: string, now = new Date()): number {
  const [year, month, day] = parts(iso)
  const hadBirthday = now.getMonth() + 1 > month || (now.getMonth() + 1 === month && now.getDate() >= day)
  return now.getFullYear() - year - (hadBirthday ? 0 : 1)
}

// «1 год», «2 года», «5 лет»
export function formatAge(age: number): string {
  const lastTwo = age % 100
  const last = age % 10
  if (lastTwo >= 11 && lastTwo <= 14) return `${age} лет`
  if (last === 1) return `${age} год`
  if (last >= 2 && last <= 4) return `${age} года`
  return `${age} лет`
}

// сегодняшняя дата в формате YYYY-MM-DD по местному времени (для атрибута max у поля даты)
export function todayIso(now = new Date()): string {
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}

// YYYY-MM-DD плюс days дней (календарная арифметика без часовых поясов)
export function addDays(iso: string, days: number): string {
  const [year, month, day] = parts(iso)
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10)
}

// «12 октября»
export function formatDayMonth(iso: string): string {
  const [year, month, day] = parts(iso)
  return new Date(year, month - 1, day).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })
}

// «Сегодня», «Завтра» или «Пн, 12 октября» (для заголовков списка)
export function formatDayHeading(iso: string, today: string): string {
  if (iso === today) return 'Сегодня'
  if (iso === addDays(today, 1)) return 'Завтра'
  const [year, month, day] = parts(iso)
  const text = new Date(year, month - 1, day).toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric', month: 'long' })
  return text.charAt(0).toUpperCase() + text.slice(1)
}

// день недели даты YYYY-MM-DD в формате ISO: 1 = понедельник ... 7 = воскресенье
export function isoWeekdayOf(iso: string): number {
  const [year, month, day] = parts(iso)
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay() || 7
}

// «11 октября, 10:00»: когда что-то произошло (по местному времени)
export function formatDateTime(iso: string): string {
  const at = new Date(iso)
  const day = at.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })
  const time = at.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
  return `${day}, ${time}`
}
