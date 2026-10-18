// Дни недели в формате ISO: 1 = понедельник ... 7 = воскресенье (у JS getDay() воскресенье = 0).
export const WEEK_DAYS = [
  { value: 1, short: 'Пн', full: 'Понедельник', inDay: 'в понедельник' },
  { value: 2, short: 'Вт', full: 'Вторник', inDay: 'во вторник' },
  { value: 3, short: 'Ср', full: 'Среда', inDay: 'в среду' },
  { value: 4, short: 'Чт', full: 'Четверг', inDay: 'в четверг' },
  { value: 5, short: 'Пт', full: 'Пятница', inDay: 'в пятницу' },
  { value: 6, short: 'Сб', full: 'Суббота', inDay: 'в субботу' },
  { value: 7, short: 'Вс', full: 'Воскресенье', inDay: 'в воскресенье' },
]

// день недели даты в формате ISO
export const isoWeekday = (date: Date) => date.getDay() || 7
