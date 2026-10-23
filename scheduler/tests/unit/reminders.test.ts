import { describe, expect, it } from 'vitest'
import { eventMessages, taskMessages, type EventInfo, type TaskInfo } from '../../src/messages.js'
import type { LocalTime } from '../../src/time.js'

const L = (date: string, hour: number, minute = 0): LocalTime => {
  const [year, month, day] = date.split('-').map(Number)
  return { year, month, day, hour, minute, weekday: new Date(Date.UTC(year, month - 1, day)).getUTCDay(), date }
}

describe('напоминания о событиях', () => {
  const timed: EventInfo = { id: 'e1', title: 'Театр', startDate: '2026-10-24', startTime: '15:00' }
  const allDay: EventInfo = { id: 'e2', title: 'Поездка', startDate: '2026-10-24', startTime: null }

  it('со временем: за час до начала, в окне 15 минут', () => {
    expect(eventMessages([timed], L('2026-10-24', 13, 59))).toEqual([])
    const [msg] = eventMessages([timed], L('2026-10-24', 14, 0))
    expect(msg.message).toMatchObject({ title: 'Скоро событие', body: 'Театр в 15:00', url: '/calendar/events/e1' })
    expect(eventMessages([timed], L('2026-10-24', 14, 14))).toHaveLength(1)
    expect(eventMessages([timed], L('2026-10-24', 14, 15))).toEqual([])
  })

  it('на весь день: утром, с окном догона', () => {
    expect(eventMessages([allDay], L('2026-10-24', 8, 59))).toEqual([])
    expect(eventMessages([allDay], L('2026-10-24', 9, 0))[0].message.title).toBe('Сегодня событие')
    expect(eventMessages([allDay], L('2026-10-24', 11, 0))).toEqual([])
  })

  it('чужой день не напоминает', () => {
    expect(eventMessages([timed, allDay], L('2026-10-25', 14, 0))).toEqual([])
  })
})

describe('напоминания о заданиях', () => {
  const base: TaskInfo = { id: 't1', title: 'Уборка', date: '2026-10-24', dueTime: '18:30', repeatType: 'none', repeatDays: [], repeatUntil: null }

  it('со временем: в назначенную минуту', () => {
    expect(taskMessages([base], L('2026-10-24', 18, 29))).toEqual([])
    const [msg] = taskMessages([base], L('2026-10-24', 18, 30))
    expect(msg.message).toMatchObject({ title: 'Пора выполнить задание', url: '/tasks/t1?date=2026-10-24' })
  })

  it('без времени: утром', () => {
    const task = { ...base, dueTime: null }
    expect(taskMessages([task], L('2026-10-24', 9, 0))[0].message.title).toBe('Задание на сегодня')
    expect(taskMessages([task], L('2026-10-24', 12, 0))).toEqual([])
  })

  it('повторяющееся: только в дни повтора', () => {
    const weekly: TaskInfo = { ...base, date: '2026-10-19', repeatType: 'weekly', repeatDays: [6] }
    expect(taskMessages([weekly], L('2026-10-24', 18, 30))).toHaveLength(1)
    expect(taskMessages([weekly], L('2026-10-25', 18, 30))).toEqual([])
  })
})
