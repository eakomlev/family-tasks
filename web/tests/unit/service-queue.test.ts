import { describe, expect, it } from 'vitest'
import { formatAge, formatBytes, mediaAlerts, MAIL_WARN_SHARE, nextUtcMidnightLabel, queueAlerts, QUOTA_WARN_SHARE, STALE_SECONDS, TICK_STALE_SECONDS } from '@/pages/Service/utils'
import type { MediaStats, QueueStats } from '@/store/admin'

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

  describe('планировщик', () => {
    const sched = (over: object = {}) => ({
      alive: true, instances: 1, lastBeatSeconds: 4, lastTickSeconds: 20, lastSent: 3, lastError: null, ...over,
    })

    it('жив и недавно делал проход: предупреждений нет; сервер старой версии (поля нет) тоже молчит', () => {
      expect(queueAlerts(healthy({ scheduler: sched() }), NOW)).toEqual([])
      expect(queueAlerts(healthy(), NOW)).toEqual([])
    })

    it('не отвечает: ошибка с давностью сигнала', () => {
      const [alert] = queueAlerts(healthy({ scheduler: sched({ alive: false, instances: 0, lastBeatSeconds: 600 }) }), NOW)
      expect(alert).toMatchObject({ tone: 'error' })
      expect(alert.text).toMatch(/Планировщик \(scheduler\) не отвечает/)
      expect(alert.text).toMatch(/10 мин назад/)
    })

    it('жив, но проход давно не шёл: предупреждение; пока проходов не было (только запустился), молчим', () => {
      const [alert] = queueAlerts(healthy({ scheduler: sched({ lastTickSeconds: TICK_STALE_SECONDS + 1 }) }), NOW)
      expect(alert).toMatchObject({ tone: 'warning' })
      expect(alert.text).toMatch(/не делал проход 5 мин/)
      expect(queueAlerts(healthy({ scheduler: sched({ lastTickSeconds: TICK_STALE_SECONDS }) }), NOW)).toEqual([])
      expect(queueAlerts(healthy({ scheduler: sched({ lastTickSeconds: null, lastSent: null }) }), NOW)).toEqual([])
    })

    it('последний проход кончился ошибкой: предупреждение с её текстом', () => {
      const [alert] = queueAlerts(healthy({ scheduler: sched({ lastError: 'очередь недоступна' }) }), NOW)
      expect(alert).toMatchObject({ tone: 'warning' })
      expect(alert.text).toMatch(/очередь недоступна/)
    })
  })
})

describe('formatBytes', () => {
  it.each([
    [0, '0 Б'],
    [512, '512 Б'],
    [1024, '1,0 КБ'],
    [1536, '1,5 КБ'],
    [5 * 1024 * 1024, '5,0 МБ'],
    [250 * 1024 * 1024, '250 МБ'],
    [2 * 1024 * 1024 * 1024, '2,0 ГБ'],
    [-5, '0 Б'],
  ])('%s → %s', (bytes, text) => {
    expect(formatBytes(bytes)).toBe(text)
  })
})

describe('mediaAlerts', () => {
  const GB = 1024 * 1024 * 1024
  const ok = (over: Partial<MediaStats> = {}): MediaStats => ({
    configured: true, alive: true, photos: 10, bytes: 5_000_000, unattached: { photos: 0, bytes: 0 }, quotaBytes: 2 * GB, busiestFamilyBytes: 100_000_000, ...over,
  })

  it('всё в порядке: предупреждений нет', () => {
    expect(mediaAlerts(ok())).toEqual([])
  })

  it('фото не настроены: тихое пояснение, а не ошибка', () => {
    const alerts = mediaAlerts(ok({ configured: false, alive: false }))
    expect(alerts).toHaveLength(1)
    expect(alerts[0].tone).toBe('muted')
    expect(alerts[0].text).toMatch(/MEDIA_SECRET/)
  })

  it('сервис не отвечает: ошибка', () => {
    const [alert] = mediaAlerts(ok({ alive: false }))
    expect(alert).toMatchObject({ tone: 'error' })
    expect(alert.text).toMatch(/не отвечает/)
  })

  it('семья заняла от 80% квоты: предупреждение с долей, исчерпала: ошибка', () => {
    const near = mediaAlerts(ok({ busiestFamilyBytes: 2 * GB * QUOTA_WARN_SHARE }))
    expect(near[0]).toMatchObject({ tone: 'warning' })
    expect(near[0].text).toMatch(/80%/)
    expect(mediaAlerts(ok({ busiestFamilyBytes: 2 * GB * 0.79 }))).toEqual([])
    expect(mediaAlerts(ok({ busiestFamilyBytes: 2 * GB }))[0]).toMatchObject({ tone: 'error' })
  })

  it('нулевая квота не делит на ноль и не шумит', () => {
    expect(mediaAlerts(ok({ quotaBytes: 0, busiestFamilyBytes: 5 }))).toEqual([])
  })
})
