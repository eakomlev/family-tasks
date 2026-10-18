import { useCallback, useState } from 'react'
import { getKv } from '@/lib/kv'

// Настройки семейного календаря хранятся на устройстве отдельно для каждого участника: что показывать и чьё.
export type CalendarView = 'day' | 'week' | 'month'
export type CalendarKind = 'event' | 'task' | 'birthday' | 'training' | 'holiday'

export const CALENDAR_KINDS: { kind: CalendarKind; label: string }[] = [
  { kind: 'event', label: 'События' },
  { kind: 'task', label: 'Задания' },
  { kind: 'birthday', label: 'Дни рождения' },
  { kind: 'training', label: 'Тренировки' },
  { kind: 'holiday', label: 'Праздники России' },
]

export interface CalendarSettings {
  // вид, с которого открывается календарь
  view: CalendarView
  // какие виды записей показывать
  kinds: Record<CalendarKind, boolean>
  // чьи записи скрыты (хранятся скрытые, чтобы новые участники семьи были видны сразу)
  hiddenMembers: string[]
}

export const DEFAULT_SETTINGS: CalendarSettings = {
  view: 'month',
  kinds: { event: true, task: true, birthday: true, training: true, holiday: true },
  hiddenMembers: [],
}

const keyOf = (memberId: string) => `calendar-settings:${memberId}`

const VIEWS: CalendarView[] = ['day', 'week', 'month']

// Читает сохранённое и дополняет значениями по умолчанию: испорченное или устаревшее не ломает календарь
export function loadSettings(memberId: string): CalendarSettings {
  try {
    const raw = getKv().getItem(keyOf(memberId))
    if (!raw) return DEFAULT_SETTINGS
    const parsed = JSON.parse(raw) as Partial<CalendarSettings> | null
    if (!parsed || typeof parsed !== 'object') return DEFAULT_SETTINGS
    const kinds = { ...DEFAULT_SETTINGS.kinds }
    for (const { kind } of CALENDAR_KINDS) if (typeof parsed.kinds?.[kind] === 'boolean') kinds[kind] = parsed.kinds[kind]
    return {
      view: VIEWS.includes(parsed.view as CalendarView) ? (parsed.view as CalendarView) : DEFAULT_SETTINGS.view,
      kinds,
      hiddenMembers: Array.isArray(parsed.hiddenMembers) ? parsed.hiddenMembers.filter((id): id is string => typeof id === 'string') : [],
    }
  } catch {
    return DEFAULT_SETTINGS
  }
}

export function saveSettings(memberId: string, settings: CalendarSettings): void {
  try {
    getKv().setItem(keyOf(memberId), JSON.stringify(settings))
  } catch {
    // без хранилища настройки живут до перезагрузки
  }
}

// Настройки участника: читаются при открытии, каждое изменение сразу сохраняется
export function useCalendarSettings(memberId: string) {
  const [settings, setSettings] = useState(() => loadSettings(memberId))
  const update = useCallback(
    (change: (current: CalendarSettings) => CalendarSettings) => {
      setSettings((current) => {
        const next = change(current)
        saveSettings(memberId, next)
        return next
      })
    },
    [memberId],
  )
  return [settings, update] as const
}
