const pad = (n: number) => String(n).padStart(2, '0')

export const HOURS = Array.from({ length: 24 }, (_, h) => pad(h))

// Минуты с шагом; если текущая минута не попадает в шаг (например, 07), она добавляется, чтобы значение не терялось
export function minuteValues(step: number, current?: string): string[] {
  const values = Array.from({ length: Math.ceil(60 / step) }, (_, i) => pad(i * step))
  if (current && !values.includes(current)) values.push(current)
  return values.sort()
}

export const splitTime = (value: string): [string, string] => [value.slice(0, 2), value.slice(3, 5)]

// Быстрый выбор: самые частые времена, чтобы не крутить колёса
export const QUICK_TIMES = ['08:00', '09:00', '12:00', '15:00', '18:00', '20:00']
