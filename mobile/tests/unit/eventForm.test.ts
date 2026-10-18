import { describe, expect, it } from 'vitest'
import { emptyEventForm, plusHour, toInput, validateEvent, withEnd, withStart } from '@/features/calendar/eventForm'

describe('форма события: правила', () => {
  it('конец подтягивается за началом', () => {
    const form = emptyEventForm('2026-11-07')
    expect(withStart(form, { startTime: '15:00' }).endTime).toBe('16:00')
    expect(withStart(form, { startTime: '23:30' }).endTime).toBe('23:59')
    // позже начала конец не трогаем
    expect(withStart({ ...form, endTime: '18:00' }, { startTime: '15:00' }).endTime).toBe('18:00')
    expect(withStart(form, { startDate: '2026-11-10' })).toMatchObject({ startDate: '2026-11-10', endDate: '2026-11-10' })
    expect(withEnd(form, { endDate: '2026-11-01' }).endDate).toBe('2026-11-07')
    expect(plusHour('08:15')).toBe('09:15')
  })

  it('проверка и отправляемые данные', () => {
    const ok = { ...emptyEventForm('2026-11-07'), title: ' Театр ' }
    expect(validateEvent(ok)).toBeNull()
    expect(validateEvent({ ...ok, title: '  ' })).toMatch(/название/)
    expect(validateEvent({ ...ok, endDate: '2026-11-06' })).toMatch(/раньше/)
    expect(validateEvent({ ...ok, startTime: '12:00', endTime: '11:00' })).toMatch(/позже начала/)
    // в многодневном событии конец может быть «раньше» по часам, на весь день время не важно
    expect(validateEvent({ ...ok, endDate: '2026-11-08', startTime: '20:00', endTime: '09:00' })).toBeNull()
    expect(validateEvent({ ...ok, allDay: true, startTime: '12:00', endTime: '11:00' })).toBeNull()
    expect(toInput(ok)).toEqual({ title: 'Театр', startDate: '2026-11-07', endDate: '2026-11-07', startTime: '10:00', endTime: '11:00', allFamily: true, memberIds: [] })
    expect(toInput({ ...ok, allDay: true, allFamily: false, memberIds: ['kid'] })).toMatchObject({ startTime: null, endTime: null, allFamily: false, memberIds: ['kid'] })
    // при «вся семья» выбранные участники не отправляются
    expect(toInput({ ...ok, allFamily: true, memberIds: ['kid'] }).memberIds).toEqual([])
  })
})
