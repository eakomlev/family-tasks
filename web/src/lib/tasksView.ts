import { useCallback, useState } from 'react'

// Показ завершённых заданий на странице «Задания» запоминается на устройстве (отдельно для каждого участника)
export interface TasksView {
  // показывать ли выполненные задания (за месяц) под предстоящими
  showDone: boolean
}

const DEFAULT: TasksView = { showDone: false }

const keyFor = (memberId: string) => `tasksView:${memberId}`

export function parseTasksView(raw: string | null): TasksView {
  if (!raw) return DEFAULT
  try {
    return { showDone: (JSON.parse(raw) as { showDone?: unknown }).showDone === true }
  } catch {
    return DEFAULT
  }
}

export function loadTasksView(memberId: string | undefined): TasksView {
  if (!memberId) return DEFAULT
  try {
    return parseTasksView(localStorage.getItem(keyFor(memberId)))
  } catch {
    return DEFAULT
  }
}

export function saveTasksView(memberId: string | undefined, view: TasksView) {
  if (!memberId) return
  try {
    localStorage.setItem(keyFor(memberId), JSON.stringify(view))
  } catch {
    /* не сохранилось: в следующий раз откроется как по умолчанию */
  }
}

export function useTasksView(memberId: string | undefined): [TasksView, (change: Partial<TasksView>) => void] {
  const [view, setView] = useState(() => loadTasksView(memberId))
  const change = useCallback(
    (patch: Partial<TasksView>) => {
      setView((current) => {
        const next = { ...current, ...patch }
        saveTasksView(memberId, next)
        return next
      })
    },
    [memberId],
  )
  return [view, change]
}
