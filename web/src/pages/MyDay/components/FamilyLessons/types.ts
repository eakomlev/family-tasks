import type { Lesson } from '@/api'

export interface FamilyLessonsProps {
  now: Date
}

// id ребёнка -> уроки; null — загрузка не удалась
export type LessonsByChild = Record<string, Lesson[] | null>
