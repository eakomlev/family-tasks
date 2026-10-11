import type { Lesson, Member, Training } from '@/api'
import type { TaskEntry } from '@/lib/occurrences'

export interface ChildCardProps {
  child: Member
  // undefined — ещё грузим, null — не удалось загрузить
  lessons: Lesson[] | null | undefined
  // то же для тренировок; null или undefined — строку с тренировкой не показываем
  trainings?: Training[] | null
  // задания ребёнка на сегодня (и выполненные); undefined — ещё грузим
  tasks?: TaskEntry[]
  now: Date
}
