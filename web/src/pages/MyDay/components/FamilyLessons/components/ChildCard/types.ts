import type { Lesson, Member, Training } from '@/api'

export interface ChildCardProps {
  child: Member
  // undefined — ещё грузим, null — не удалось загрузить
  lessons: Lesson[] | null | undefined
  // то же для тренировок; null или undefined — строку с тренировкой не показываем
  trainings?: Training[] | null
  now: Date
}
