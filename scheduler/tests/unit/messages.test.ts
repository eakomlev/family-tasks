import { describe, expect, it } from 'vitest'
import {
  birthdayMessages,
  formatYears,
  isBirthdayOn,
  lessonsMessage,
  nextSchoolDay,
  trainingMessages,
  type LessonInfo,
  type MemberInfo,
  type TrainingInfo,
} from '../../src/messages.js'
import type { LocalTime } from '../../src/time.js'

// Локальное время в нужную дату; день недели считается по календарю.
const L = (date: string, hour = 10, minute = 0): LocalTime => {
  const [year, month, day] = date.split('-').map(Number)
  return { year, month, day, hour, minute, weekday: new Date(Date.UTC(year, month - 1, day)).getUTCDay(), date }
}

describe('formatYears', () => {
  it('склоняет «год/года/лет»', () => {
    expect([1, 2, 5, 11, 12, 21, 22, 25, 101, 111].map(formatYears)).toEqual([
      '1 год', '2 года', '5 лет', '11 лет', '12 лет', '21 год', '22 года', '25 лет', '101 год', '111 лет',
    ])
  })
})

describe('дни рождения', () => {
  const family: MemberInfo[] = [
    { id: 'misha', name: 'Миша', birthDate: '2014-10-10' },
    { id: 'mom', name: 'Лена', birthDate: '1985-05-12' },
    { id: 'newborn', name: 'Малыш', birthDate: '2026-10-10' },
    { id: 'nodate', name: 'Без даты', birthDate: null },
  ]

  it('остальным: «исполняется N», ссылка на карточку именинника', () => {
    const [msg] = birthdayMessages('mom', family, L('2026-10-10'))
    expect(msg.kind).toBe('birthday:misha')
    expect(msg.message).toMatchObject({ title: 'Сегодня день рождения 🎂', body: 'Миша: исполняется 12 лет', url: '/family/misha' })
  })

  it('именинника поздравляют отдельным текстом', () => {
    const [msg] = birthdayMessages('misha', family, L('2026-10-10'))
    expect(msg.message).toMatchObject({ title: 'С днём рождения, Миша! 🎉', url: '/profile' })
  })

  it('в год рождения и без даты не поздравляют', () => {
    expect(birthdayMessages('mom', family, L('2026-10-10')).map((m) => m.kind)).toEqual(['birthday:misha'])
  })

  it('в другой день ничего', () => {
    expect(birthdayMessages('mom', family, L('2026-10-11'))).toEqual([])
  })

  it('29 февраля в невисокосный год отмечают 28-го', () => {
    expect(isBirthdayOn('2000-02-29', L('2028-02-29'))).toBe(true)
    expect(isBirthdayOn('2000-02-29', L('2026-02-28'))).toBe(true)
    expect(isBirthdayOn('2000-02-29', L('2028-02-28'))).toBe(false)
    expect(isBirthdayOn('2000-02-29', L('2026-03-01'))).toBe(false)
  })
})

describe('следующий учебный день и уроки', () => {
  const les = (...days: number[]): LessonInfo[] => days.map((weekday) => ({ weekday, subject: `П${weekday}`, startsAt: null, endsAt: null }))
  const full = les(1, 2, 3, 4, 5, 6)
  const fiveDays = les(1, 2, 3, 4, 5)

  it('среда → четверг', () => expect(nextSchoolDay(L('2026-10-07'), full)).toEqual({ weekday: 4, offset: 1 }))
  it('пятница → суббота, если по субботам есть уроки', () => expect(nextSchoolDay(L('2026-10-09'), full)).toEqual({ weekday: 6, offset: 1 }))
  it('пятница → понедельник, если суббота без уроков', () => expect(nextSchoolDay(L('2026-10-09'), fiveDays)).toEqual({ weekday: 1, offset: 3 }))
  it('суббота → понедельник', () => expect(nextSchoolDay(L('2026-10-10'), full)).toEqual({ weekday: 1, offset: 2 }))
  it('воскресенье → понедельник', () => expect(nextSchoolDay(L('2026-10-11'), full)).toEqual({ weekday: 1, offset: 1 }))

  const withTimes: LessonInfo[] = [
    { weekday: 1, subject: 'Литература', startsAt: '09:25', endsAt: '10:10' },
    { weekday: 1, subject: 'Математика', startsAt: '08:30', endsAt: '09:15' },
    { weekday: 3, subject: 'Шахматы', startsAt: null, endsAt: null },
  ]

  it('в воскресенье вечером: «Завтра уроки» с промежутком времени', () => {
    expect(lessonsMessage(withTimes, L('2026-10-11'))?.message).toMatchObject({
      title: 'Завтра уроки',
      body: 'Литература, Математика · 08:30–10:10',
      url: '/my-day',
    })
  })

  it('в субботу: «Уроки в понедельник»', () => {
    expect(lessonsMessage(withTimes, L('2026-10-10'))?.message.title).toBe('Уроки в понедельник')
  })

  it('без времени показывает только предметы', () => {
    expect(lessonsMessage(withTimes, L('2026-10-06'))?.message).toMatchObject({ title: 'Завтра уроки', body: 'Шахматы' })
  })

  it('если в следующий день уроков нет, ничего не шлём', () => {
    expect(lessonsMessage(withTimes, L('2026-10-07'))).toBeNull()
    expect(lessonsMessage([], L('2026-10-07'))).toBeNull()
  })
})

describe('напоминания о тренировках за 2 часа', () => {
  const T = (weekday: number, title: string, startsAt: string | null, place: string | null = null): TrainingInfo => ({ weekday, title, place, startsAt })
  const swim = [T(2, 'Плавание', '18:00', 'Бассейн «Волна»')]
  const count = (trainings: TrainingInfo[], local: LocalTime) => trainingMessages(trainings, local).length

  it('окно 15 минут: ровно за 2 часа и ещё 14 минут', () => {
    // 6 октября 2026 — вторник
    expect([15, 16, 16, 16].map((h, i) => count(swim, L('2026-10-06', h, [59, 0, 14, 15][i])))).toEqual([0, 1, 1, 0])
  })

  it('текст с местом и без него', () => {
    const [msg] = trainingMessages(swim, L('2026-10-06', 16))
    expect(msg).toMatchObject({ kind: 'training:18:00:Плавание', day: '2026-10-06' })
    expect(msg.message).toMatchObject({ title: 'Через 2 часа тренировка', body: 'Плавание в 18:00 · Бассейн «Волна»', url: '/my-day' })
    expect(trainingMessages([T(2, 'Растяжка', '18:00')], L('2026-10-06', 16))[0].message.body).toBe('Растяжка в 18:00')
  })

  it('другой день недели и тренировка без времени не напоминаются', () => {
    expect(count(swim, L('2026-10-07', 16))).toBe(0)
    expect(count([T(2, 'Футбол', null)], L('2026-10-06', 16))).toBe(0)
  })

  it('тренировка после полуночи анонсируется накануне вечером, журнал привязан к её дню', () => {
    const early = [T(3, 'Зарядка', '01:30')]
    const [msg] = trainingMessages(early, L('2026-10-06', 23, 30))
    expect(msg.day).toBe('2026-10-07')
    expect([L('2026-10-06', 23, 29), L('2026-10-07', 0, 10), L('2026-10-07', 1, 0)].map((l) => count(early, l))).toEqual([0, 0, 0])
  })

  it('воскресенье это день 7', () => {
    expect(count([T(7, 'Футбол', '10:00')], L('2026-10-11', 8))).toBe(1)
    expect(count([T(7, 'Футбол', '10:00')], L('2026-10-12', 8))).toBe(0)
    expect(count([T(7, 'Бег', '01:30')], L('2026-10-10', 23, 30))).toBe(1)
  })

  it('две тренировки в одно время дают два уведомления с разными ключами', () => {
    const msgs = trainingMessages([T(2, 'А', '18:00'), T(2, 'Б', '18:00')], L('2026-10-06', 16))
    expect(new Set(msgs.map((m) => m.kind)).size).toBe(2)
  })
})
