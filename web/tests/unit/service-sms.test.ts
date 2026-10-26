import { describe, expect, it } from 'vitest'
import type { SmsStats } from '@/store/admin'
import { formatDay, formatRub, smsAlerts, smsLeft } from '@/pages/Service/utils'

const sms = (over: Partial<SmsStats> = {}): SmsStats => ({
  configured: true,
  balance: { amount: 530.22, checkedSeconds: 60, error: null },
  today: { sent: 5, failed: 0, spend: 49.45 },
  week: { sent: 10, failed: 0, spend: 98.9 },
  days: [],
  waiting: 0,
  retrying: 0,
  limit: 100,
  usedToday: 5,
  ...over,
})
const NOW = new Date('2026-10-26T12:00:00Z')

describe('форматирование', () => {
  it('рубли с копейками, целые без них', () => {
    expect(formatRub(530.22)).toBe('530,22 ₽')
    expect(formatRub(12)).toBe('12 ₽')
    expect(formatRub(0)).toBe('0 ₽')
    expect(formatRub(1234.5)).toContain('1')
    expect(formatRub(1234.5)).toMatch(/234,50 ₽$/)
  })

  it('день без часового пояса: «26 окт»', () => {
    expect(formatDay('2026-10-26')).toBe('26 окт')
    expect(formatDay('2026-03-01')).toBe('1 мар')
  })

  it('на сколько SMS хватит остатка: по средней цене недели, иначе неизвестно', () => {
    // 98,9 / 10 = 9,89 за SMS; 530,22 / 9,89 = 53,6
    expect(smsLeft(sms())).toBe(53)
    expect(smsLeft(sms({ week: { sent: 0, failed: 0, spend: 0 } }))).toBeNull()
    expect(smsLeft(sms({ balance: { amount: null, checkedSeconds: null, error: null } }))).toBeNull()
    expect(smsLeft(sms({ balance: { amount: 0, checkedSeconds: 1, error: null } }))).toBe(0)
  })
})

describe('предупреждения по SMS', () => {
  it('всё в порядке: пусто', () => {
    expect(smsAlerts(sms(), NOW)).toEqual([])
  })

  it('не настроено: одно пояснение, остального не говорим', () => {
    const alerts = smsAlerts(sms({ configured: false, balance: { amount: null, checkedSeconds: null, error: null } }), NOW)
    expect(alerts).toHaveLength(1)
    expect(alerts[0]).toMatchObject({ tone: 'muted' })
    expect(alerts[0].text).toMatch(/SMSAERO_API_KEY/)
  })

  it('деньги на исходе: от 100 ₽ предупреждение, от 30 ₽ ошибка', () => {
    const low = smsAlerts(sms({ balance: { amount: 80, checkedSeconds: 60, error: null } }), NOW)
    expect(low).toEqual([expect.objectContaining({ tone: 'warning', text: expect.stringContaining('80 ₽') })])
    const critical = smsAlerts(sms({ balance: { amount: 12.5, checkedSeconds: 60, error: null } }), NOW)
    expect(critical).toEqual([expect.objectContaining({ tone: 'error', text: expect.stringContaining('12,50 ₽') })])
    // ровно на границе: ещё не критично, но уже предупреждение
    expect(smsAlerts(sms({ balance: { amount: 30, checkedSeconds: 60, error: null } }), NOW)[0].tone).toBe('warning')
    expect(smsAlerts(sms({ balance: { amount: 100, checkedSeconds: 60, error: null } }), NOW)).toEqual([])
  })

  it('ошибка проверки остатка и устаревший остаток', () => {
    const failed = smsAlerts(sms({ balance: { amount: 530.22, checkedSeconds: 7200, error: 'balance 401 bad key' } }), NOW)
    expect(failed).toEqual([expect.objectContaining({ tone: 'warning', text: expect.stringContaining('bad key') })])
    const stale = smsAlerts(sms({ balance: { amount: 530.22, checkedSeconds: 1200, error: null } }), NOW)
    expect(stale).toEqual([expect.objectContaining({ tone: 'warning', text: expect.stringContaining('20 мин') })])
  })

  it('дневной лимит: от 80% предупреждение, исчерпан ошибка; без лимита молчим', () => {
    expect(smsAlerts(sms({ usedToday: 80 }), NOW)).toEqual([expect.objectContaining({ tone: 'warning', text: expect.stringContaining('80%') })])
    expect(smsAlerts(sms({ usedToday: 100 }), NOW)).toEqual([expect.objectContaining({ tone: 'error', text: expect.stringContaining('лимит SMS исчерпан') })])
    expect(smsAlerts(sms({ limit: 0, usedToday: 5000 }), NOW)).toEqual([])
  })

  it('неудачи сегодня', () => {
    expect(smsAlerts(sms({ today: { sent: 5, failed: 2, spend: 49.45 } }), NOW)).toEqual([expect.objectContaining({ tone: 'warning', text: expect.stringContaining('SMS: 2') })])
  })
})
