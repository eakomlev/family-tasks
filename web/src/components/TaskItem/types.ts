import type { Member, Occurrence, Task } from '@/api'

export interface TaskItemProps {
  task: Task
  occurrence: Occurrence
  // исполнитель: по нему подбирается подпись автора («от мамы» для ребёнка)
  assignee?: Member
  // писать имя исполнителя (не нужно, если список уже отфильтрован по нему)
  showAssignee?: boolean
  // автор; показываем «от …», только если он не исполнитель
  author?: Member
  // кто выполнил (для списка выполненных)
  doneBy?: Member
  // писать дату вхождения (в списке выполненных, где нет заголовков дней)
  showDate?: boolean
  // сегодняшняя дата YYYY-MM-DD: по ней определяется просрочка
  today: string
  // родителю у карточки «на проверке» показываем кнопки «Подтвердить» и «Вернуть»
  review?: ReviewActions
}

// сделано, ещё нет, просрочено, ждёт проверки родителем
export type TaskState = 'todo' | 'done' | 'late' | 'pending'

export interface ReviewActions {
  onConfirm: () => void
  onReject: () => void
  // идёт запрос: кнопки заблокированы
  busy?: boolean
}
