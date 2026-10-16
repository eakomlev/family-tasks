// Государственные праздники России (ст. 112 Трудового кодекса): те, что приходятся на одни и те же числа каждый год.
// Переносы выходных, которые правительство объявляет на каждый год отдельно, не учитываются.

interface Holiday {
  month: number
  day: number
  title: string
}

const HOLIDAYS: Holiday[] = [
  { month: 1, day: 1, title: 'Новый год' },
  { month: 1, day: 2, title: 'Новогодние каникулы' },
  { month: 1, day: 3, title: 'Новогодние каникулы' },
  { month: 1, day: 4, title: 'Новогодние каникулы' },
  { month: 1, day: 5, title: 'Новогодние каникулы' },
  { month: 1, day: 6, title: 'Новогодние каникулы' },
  { month: 1, day: 7, title: 'Рождество Христово' },
  { month: 1, day: 8, title: 'Новогодние каникулы' },
  { month: 2, day: 23, title: 'День защитника Отечества' },
  { month: 3, day: 8, title: 'Международный женский день' },
  { month: 5, day: 1, title: 'Праздник Весны и Труда' },
  { month: 5, day: 9, title: 'День Победы' },
  { month: 6, day: 12, title: 'День России' },
  { month: 11, day: 4, title: 'День народного единства' },
]

// Название праздника в этот день (YYYY-MM-DD) или null
export function holidayOn(iso: string): string | null {
  const month = Number(iso.slice(5, 7))
  const day = Number(iso.slice(8, 10))
  return HOLIDAYS.find((h) => h.month === month && h.day === day)?.title ?? null
}
