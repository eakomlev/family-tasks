import { useSyncExternalStore } from 'react'
import { getKv } from '@/lib/kv'

// Фильтр по человеку и показ завершённых на экране «Задания» запоминаются на устройстве (отдельно для каждого участника).
// Меню с переключателем стоит в углу оболочки, а список в самом экране, поэтому состояние общее и с подпиской.
export interface TasksView {
  // показывать ли выполненные задания (за месяц) под предстоящими
  showDone: boolean
  // null — все; иначе id участника
  filter: string | null
}

const DEFAULT: TasksView = { showDone: false, filter: null }

const keyFor = (memberId: string) => `tasksView:${memberId}`

export function parseTasksView(raw: string | null): TasksView {
  if (!raw) return DEFAULT
  try {
    const value = JSON.parse(raw) as { showDone?: unknown; filter?: unknown }
    return {
      showDone: value.showDone === true,
      filter: typeof value.filter === 'string' ? value.filter : null,
    }
  } catch {
    return DEFAULT
  }
}

export function loadTasksView(memberId: string | undefined): TasksView {
  if (!memberId) return DEFAULT
  try {
    return parseTasksView(getKv().getItem(keyFor(memberId)))
  } catch {
    return DEFAULT
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

// Общее состояние в памяти (по участнику), чтобы меню в углу и список видели одно и то же
const current = new Map<string, TasksView>()
const listeners = new Set<() => void>()

function snapshot(memberId: string | undefined): TasksView {
  if (!memberId) return DEFAULT
  let value = current.get(memberId)
  if (!value) {
    value = loadTasksView(memberId)
    current.set(memberId, value)
  }
  return value
}

export function updateTasksView(memberId: string | undefined, change: Partial<TasksView>) {
  if (!memberId) return
  const next = { ...snapshot(memberId), ...change }
  current.set(memberId, next)
  saveTasksView(memberId, next)
  listeners.forEach((listener) => listener())
}

// Для тестов: забыть состояние в памяти
export const resetTasksViewCache = () => current.clear()

const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => void listeners.delete(listener)
}

export function useTasksView(memberId: string | undefined): [TasksView, (change: Partial<TasksView>) => void] {
  const view = useSyncExternalStore(subscribe, () => snapshot(memberId), () => DEFAULT)
  return [view, (change) => updateTasksView(memberId, change)]
}
