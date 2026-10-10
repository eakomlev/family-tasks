import type { Member, Occurrence, Task } from '@/api'

export interface TaskItemProps {
  task: Task
  occurrence: Occurrence
  // исполнитель; не показываем, если список уже отфильтрован по нему
  assignee?: Member
  // кто выполнил (для списка выполненных)
  doneBy?: Member
  // сегодняшняя дата YYYY-MM-DD: по ней определяется просрочка
  today: string
  disabled?: boolean
  onToggle: () => void
}
