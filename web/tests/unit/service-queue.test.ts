import { describe, expect, it } from 'vitest'
import { formatAge, MAIL_WARN_SHARE, nextUtcMidnightLabel, queueAlerts, STALE_SECONDS } from '@/pages/Service/utils'
import type { QueueStats } from '@/store/admin'

// 13 октября 2026, 10:00 по Москве (часовой пояс прогона фиксирован)
const NOW = new Date('2026-10-13T07:00:00Z')

const healthy = (over: Partial<QueueStats> = {}): QueueStats => ({
  notifier: { alive: true, instances: 1, lastBeatSeconds: 4 },
  waiting: { email: 0, push: 0 },
  retrying: 0,
  oldestSeconds: null,
  mail: { usedToday: 100, limit: 3000 },
  today: { email: { sent: 50, failed: 0 }, push: { sent: 200, failed: 0 } },
  ...over,
})

describe('formatAge', () => {
  it.each([
    [0, '0 с'],
    [45, '45 с'],
    [60, '1 мин'],
    [185, '3 мин'],
    [3600, '1 ч'],
    [7500, '2 ч 5 мин'],
    [-5, '0 с'],
    [12.7, '12 с'],
  ])('%s → %s', (seconds, text) => {
    expect(formatAge(seconds)).toBe(text)
  })
})

describe('nextUtcMidnightLabel', () => {
  it('полночь по UTC во времени устройства: для Москвы 03:00', () => {
    expect(nextUtcMidnightLabel(NOW)).toBe('03:00')
    // за минуту до полуночи по UTC ближайшая полночь всё та же
    expect(nextUtcMidnightLabel(new Date('2026-10-13T23:59:00Z'))).toBe('03:00')
  })
})

describe('queueAlerts', () => {
  it('всё в порядке: предупреждений нет', () => {
    expect(queueAlerts(healthy(), NOW)).toEqual([])
  })

  it('notifier не отвечает: ошибка с давностью последнего сигнала', () => {
    const [alert] = queueAlerts(healthy({ notifier: { alive: false, instances: 0, lastBeatSeconds: 600 } }), NOW)
    expect(alert).toMatchObject({ tone: 'error' })
    expect(alert.text).toMatch(/не отвечает/)
    expect(alert.text).toMatch(/10 мин назад/)
  })

  it('notifier никогда не запускался: без давности', () => {
    const [alert] = queueAlerts(healthy({ notifier: { alive: false, instances: 0, lastBeatSeconds: null } }), NOW)
    expect(alert.text).not.toMatch(/Последний сигнал/)
  })

  it('старейшее сообщение ждёт дольше порога: предупреждение; ровно порог ещё норма', () => {
    expect(queueAlerts(healthy({ oldestSeconds: STALE_SECONDS }), NOW)).toEqual([])
    const [alert] = queueAlerts(healthy({ oldestSeconds: STALE_SECONDS + 1 }), NOW)
    expect(alert).toMatchObject({ tone: 'warning' })
    expect(alert.text).toMatch(/ждёт 5 мин/)
  })

  it('бюджет писем: порог предупреждения, затем ошибка с временем обновления', () => {
    const limit = 3000
    expect(queueAlerts(healthy({ mail: { usedToday: limit * MAIL_WARN_SHARE - 1, limit } }), NOW)).toEqual([])

    const [warn] = queueAlerts(healthy({ mail: { usedToday: 2400, limit } }), NOW)
    expect(warn).toMatchObject({ tone: 'warning', text: 'Израсходовано 80% дневного лимита писем.' })

    const [out] = queueAlerts(healthy({ mail: { usedToday: 3000, limit } }), NOW)
    expect(out).toMatchObject({ tone: 'error' })
    expect(out.text).toMatch(/до 03:00/)
  })

  it('лимит 0 (без лимита): про бюджет ничего не говорим', () => {
    expect(queueAlerts(healthy({ mail: { usedToday: 99999, limit: 0 } }), NOW)).toEqual([])
  })

  it('неудачи за сегодня: предупреждение с числами по каналам', () => {
    const [alert] = queueAlerts(healthy({ today: { email: { sent: 5, failed: 2 }, push: { sent: 9, failed: 1 } } }), NOW)
    expect(alert).toMatchObject({ tone: 'warning' })
    expect(alert.text).toMatch(/письма 2, push 1/)
  })

  it('несколько проблем сразу показываются все, самая тяжёлая первой', () => {
    const alerts = queueAlerts(
      healthy({ notifier: { alive: false, instances: 0, lastBeatSeconds: 900 }, oldestSeconds: 900, mail: { usedToday: 3000, limit: 3000 } }),
      NOW,
    )
    expect(alerts.map((a) => a.tone)).toEqual(['error', 'warning', 'error'])
  })
})
