import type { TaskState } from './types'

// рисунки значков: список дел, галочка в круге, часы
const PATHS: Record<TaskState, React.ReactNode> = {
  todo: (
    <>
      <path d="M9 4h6a1 1 0 0 1 1 1v1H8V5a1 1 0 0 1 1-1z" />
      <rect x="5" y="6" width="14" height="15" rx="2.5" />
      <path d="M9 12h6M9 16h4" />
    </>
  ),
  done: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m8 12.5 2.7 2.7L16 9.5" />
    </>
  ),
  late: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
}

export function TaskIcon({ state }: { state: TaskState }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden focusable="false">
      {PATHS[state]}
    </svg>
  )
}
