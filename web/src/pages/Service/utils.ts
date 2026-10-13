import type { QueueStats } from '@/store/admin'

// Сколько может ждать самое старое сообщение, прежде чем это считается проблемой.
export const STALE_SECONDS = 300
// С какой доли дневного лимита писем предупреждаем.
export const MAIL_WARN_SHARE = 0.8

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
  if (!queue.enabled) {
    return [{ tone: 'muted', text: 'Очередь выключена (QUEUE_ENABLED=false): письма и push отправляет сам server.' }]
  }
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
