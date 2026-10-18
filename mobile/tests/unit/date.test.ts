import { describe, expect, it } from 'vitest'
import {
  addDays,
  ageFromBirthDate,
  formatAge,
  formatBirthDate,
  formatDayHeading,
  formatDayMonth,
  isoWeekdayOf,
  todayIso,
} from '@/lib/date'

describe('formatAge', () => {
  it.each([
    [1, '1 год'],
    [2, '2 года'],
    [4, '4 года'],
    [5, '5 лет'],
    [11, '11 лет'],
    [12, '12 лет'],
    [14, '14 лет'],
    [21, '21 год'],
    [22, '22 года'],
    [111, '111 лет'],
    [101, '101 год'],
  ])('%i → %s', (age, text) => {
    expect(formatAge(age)).toBe(text)
  })
})

describe('ageFromBirthDate', () => {
  const now = new Date(2026, 9, 11) // 11 октября 2026

  it('в день рождения возраст уже новый', () => {
    expect(ageFromBirthDate('2016-10-11', now)).toBe(10)
  })

  it('накануне дня рождения возраст ещё прежний', () => {
    expect(ageFromBirthDate('2016-10-12', now)).toBe(9)
  })

  it('день рождения в этом году уже прошёл', () => {
    expect(ageFromBirthDate('2016-01-01', now)).toBe(10)
  })
})

describe('даты без сдвига по часовому поясу', () => {
  it('formatBirthDate не теряет день и убирает «г.»', () => {
    expect(formatBirthDate('1985-05-12')).toBe('12 мая 1985')
    expect(formatBirthDate('2000-01-01')).toBe('1 января 2000')
  })

  it('todayIso берёт местные дату и время', () => {
    expect(todayIso(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05')
    expect(todayIso(new Date(2026, 11, 31, 0, 0))).toBe('2026-12-31')
  })

  it('addDays переходит через границы месяца, года и високосный день', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
    expect(addDays('2026-10-11', 0)).toBe('2026-10-11')
  })

  it('formatDayMonth', () => {
    expect(formatDayMonth('2026-10-12')).toBe('12 октября')
  })

  it('isoWeekdayOf: понедельник 1, воскресенье 7', () => {
    expect(isoWeekdayOf('2026-10-12')).toBe(1)
    expect(isoWeekdayOf('2026-10-11')).toBe(7)
    expect(isoWeekdayOf('2026-10-17')).toBe(6)
  })
})

describe('formatDayHeading', () => {
  it('сегодня и завтра', () => {
    expect(formatDayHeading('2026-10-11', '2026-10-11')).toBe('Сегодня')
    expect(formatDayHeading('2026-10-12', '2026-10-11')).toBe('Завтра')
  })

  it('иначе день недели с заглавной буквы и датой', () => {
    const text = formatDayHeading('2026-10-14', '2026-10-11')
    expect(text).toMatch(/^Ср/)
    expect(text).toContain('14 октября')
  })

  it('«завтра» работает и через границу месяца', () => {
    expect(formatDayHeading('2026-11-01', '2026-10-31')).toBe('Завтра')
  })
})
