import type { Lesson, Member, Training } from '@/api'
import type { ChildTaskList } from './components/ChildTasks/types'

export interface ChildCardProps {
  child: Member
  // undefined — ещё грузим, null — не удалось загрузить
  lessons: Lesson[] | null | undefined
  // то же для тренировок; null или undefined — строку с тренировкой не показываем
  trainings?: Training[] | null
  // задания ребёнка: на сегодня (и выполненные) и без срока; undefined — ещё грузим
  tasks?: ChildTaskList
  now: Date
}
