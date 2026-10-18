import type { MediaStats, QueueStats } from '@/store/admin'

// Сколько может ждать самое старое сообщение, прежде чем это считается проблемой.
export const STALE_SECONDS = 300
// С какой доли дневного лимита писем предупреждаем.
export const MAIL_WARN_SHARE = 0.8
// Проход планировщика идёт раз в минуту: если с последнего больше этого, он завис или лидера нет.
export const TICK_STALE_SECONDS = 300

// «45 с», «3 мин», «2 ч 5 мин»
export function formatAge(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds))
  if (s < 60) return `${s} с`
  const minutes = Math.floor(s / 60)
  if (minutes < 60) return `${minutes} мин`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest ? `${hours} ч ${rest} мин` : `${hours} ч`
}

// Когда дневной бюджет почты начнётся заново: ближайшая полночь по UTC, во времени устройства («03:00»).
export function nextUtcMidnightLabel(now: Date): string {
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1))
  return next.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
}

export interface QueueAlert {
  tone: 'error' | 'warning' | 'muted'
  text: string
}

// Что стоит сказать администратору про очередь. Пустой список: всё в порядке.
export function queueAlerts(queue: QueueStats, now: Date): QueueAlert[] {
  const alerts: QueueAlert[] = []

  if (!queue.notifier.alive) {
    const since = queue.notifier.lastBeatSeconds === null ? '' : ` Последний сигнал ${formatAge(queue.notifier.lastBeatSeconds)} назад.`
    alerts.push({ tone: 'error', text: `Сервис отправки (notifier) не отвечает, письма и push копятся в очереди.${since}` })
  }

  if (queue.oldestSeconds !== null && queue.oldestSeconds > STALE_SECONDS) {
    alerts.push({ tone: 'warning', text: `Самое старое сообщение ждёт ${formatAge(queue.oldestSeconds)}. Проверьте сервис отправки и лимиты.` })
  }

  const { usedToday, limit } = queue.mail
  if (limit > 0 && usedToday >= limit) {
    alerts.push({
      tone: 'error',
      text: `Дневной лимит писем исчерпан: коды входа не отправляются до ${nextUtcMidnightLabel(now)} (полночь по UTC).`,
    })
  } else if (limit > 0 && usedToday >= limit * MAIL_WARN_SHARE) {
    alerts.push({ tone: 'warning', text: `Израсходовано ${Math.floor((usedToday / limit) * 100)}% дневного лимита писем.` })
  }

  const scheduler = queue.scheduler
  if (scheduler) {
    if (!scheduler.alive) {
      const since = scheduler.lastBeatSeconds === null ? '' : ` Последний сигнал ${formatAge(scheduler.lastBeatSeconds)} назад.`
      alerts.push({ tone: 'error', text: `Планировщик (scheduler) не отвечает: дни рождения, уроки и тренировки не напоминаются.${since}` })
    } else if (scheduler.lastTickSeconds !== null && scheduler.lastTickSeconds > TICK_STALE_SECONDS) {
      alerts.push({ tone: 'warning', text: `Планировщик не делал проход ${formatAge(scheduler.lastTickSeconds)}. Проверьте его лог.` })
    }
    if (scheduler.lastError) {
      alerts.push({ tone: 'warning', text: `Последний проход планировщика закончился ошибкой: ${scheduler.lastError}` })
    }
  }

  const failedMail = queue.today.email.failed
  const failedPush = queue.today.push.failed
  if (failedMail + failedPush > 0) {
    alerts.push({
      tone: 'warning',
      text: `Сегодня не удалось отправить: письма ${failedMail}, push ${failedPush}. Причины в журнале notifier.`,
    })
  }
  return alerts
}

// С какой доли квоты у самой «тяжёлой» семьи предупреждаем.
export const QUOTA_WARN_SHARE = 0.8

// «850 КБ», «1,2 МБ», «3,4 ГБ»
export function formatBytes(bytes: number): string {
  const units = ['Б', 'КБ', 'МБ', 'ГБ', 'ТБ']
  let value = Math.max(0, bytes)
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit++
  }
  const digits = unit === 0 || value >= 100 ? 0 : 1
  return `${value.toLocaleString('ru-RU', { minimumFractionDigits: digits, maximumFractionDigits: digits })} ${units[unit]}`
}

// Что стоит сказать администратору про фото. Пустой список: всё в порядке.
export function mediaAlerts(media: MediaStats): QueueAlert[] {
  if (!media.configured) {
    return [{ tone: 'muted', text: 'Отправка фото выключена: на сервере не заданы MEDIA_SECRET и MEDIA_INTERNAL_TOKEN.' }]
  }
  const alerts: QueueAlert[] = []
  if (!media.alive) {
    alerts.push({ tone: 'error', text: 'Сервис фото (media) или его хранилище не отвечает: фото не отправляются и не открываются.' })
  }
  if (media.quotaBytes > 0 && media.busiestFamilyBytes >= media.quotaBytes * QUOTA_WARN_SHARE) {
    const share = Math.floor((media.busiestFamilyBytes / media.quotaBytes) * 100)
    alerts.push({
      tone: media.busiestFamilyBytes >= media.quotaBytes ? 'error' : 'warning',
      text: `Одна из семей заняла ${share}% своей квоты на фото (${formatBytes(media.busiestFamilyBytes)} из ${formatBytes(media.quotaBytes)}).`,
    })
  }
  return alerts
}
