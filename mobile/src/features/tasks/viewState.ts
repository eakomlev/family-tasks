import { getKv } from '@/lib/kv'
import type { Tab } from './types'

// Выбранная вкладка и фильтр по человеку на экране «Задания» запоминаются на устройстве (отдельно для каждого участника)
export interface TasksView {
  tab: Tab
  // null — все; иначе id участника
  filter: string | null
}

const keyFor = (memberId: string) => `tasksView:${memberId}`

export function parseTasksView(raw: string | null): TasksView {
  const fallback: TasksView = { tab: 'upcoming', filter: null }
  if (!raw) return fallback
  try {
    const value = JSON.parse(raw) as { tab?: unknown; filter?: unknown }
    return {
      tab: value.tab === 'done' ? 'done' : 'upcoming',
      filter: typeof value.filter === 'string' ? value.filter : null,
    }
  } catch {
    return fallback
  }
}

export function loadTasksView(memberId: string | undefined): TasksView {
  if (!memberId) return { tab: 'upcoming', filter: null }
  try {
    return parseTasksView(getKv().getItem(keyFor(memberId)))
  } catch {
    return { tab: 'upcoming', filter: null }
  }
}

export function saveTasksView(memberId: string | undefined, view: TasksView) {
  if (!memberId) return
  try {
    getKv().setItem(keyFor(memberId), JSON.stringify(view))
  } catch {
    /* не сохранилось: в следующий раз откроется как по умолчанию */
  }
}
