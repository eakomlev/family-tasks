import type { Lesson, Member } from '@/api'

export interface ChildCardProps {
  child: Member
  // undefined — ещё грузим, null — не удалось загрузить
  lessons: Lesson[] | null | undefined
  now: Date
}
