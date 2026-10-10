import type { Lesson, Training } from '@/api'

export interface FamilyLessonsProps {
  now: Date
}

// null — загрузка не удалась
export interface ChildSchedules {
  lessons: Lesson[] | null
  trainings: Training[] | null
}

// id ребёнка -> его расписания
export type SchedulesByChild = Record<string, ChildSchedules>
