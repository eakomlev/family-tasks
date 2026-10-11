import { describe, expect, it } from 'vitest'
import { addDays, isDue, isValidTimeZone, localTime, SLOTS } from '../../src/notifications/time.js'

describe('localTime', () => {
  it('один момент по-разному в разных часовых поясах', () => {
    const at = new Date('2026-10-10T07:00:00Z')
    expect(localTime(at, 'Europe/Moscow')).toMatchObject({ date: '2026-10-10', hour: 10, minute: 0, weekday: 6 })
    expect(localTime(at, 'America/New_York')).toMatchObject({ date: '2026-10-10', hour: 3 })
  })

  it('следующий день, если в поясе уже за полночь', () => {
    expect(localTime(new Date('2026-10-10T20:30:00Z'), 'Asia/Tokyo')).toMatchObject({
      date: '2026-10-11', hour: 5, minute: 30, weekday: 0,
    })
  })

  it('полночь это час 0, а не 24', () => {
    expect(localTime(new Date('2026-10-10T21:00:00Z'), 'Europe/Moscow')).toMatchObject({ date: '2026-10-11', hour: 0 })
  })

  it('неизвестный пояс бросает ошибку', () => {
    expect(() => localTime(new Date(), 'Mars/Base')).toThrow()
  })
})

describe('isValidTimeZone', () => {
  it('отличает настоящие пояса от выдуманных', () => {
    expect(['Europe/Moscow', 'UTC', 'Asia/Tokyo'].map(isValidTimeZone)).toEqual([true, true, true])
    expect(['Mars/Base', '', 'garbage'].map(isValidTimeZone)).toEqual([false, false, false])
  })
})

describe('isDue: окна отправки', () => {
  const at = (hour: number, minute: number, slot = SLOTS.birthday) =>
    isDue({ year: 2026, month: 10, day: 10, hour, minute, weekday: 6, date: '2026-10-10' }, slot)

  it('день рождения: с 10:00 до 12:00, 12:00 уже поздно', () => {
    expect([at(9, 59), at(10, 0), at(11, 59), at(12, 0)]).toEqual([false, true, true, false])
  })

  it('уроки: с 17:00 до 19:00', () => {
    const slot = SLOTS.lessons
    expect([at(16, 59, slot), at(17, 0, slot), at(18, 59, slot), at(19, 0, slot)]).toEqual([false, true, true, false])
  })
})

describe('addDays', () => {
  it('календарная арифметика без часовых поясов', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29')
  })
})
