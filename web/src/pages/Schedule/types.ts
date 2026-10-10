export interface LessonDraft {
  // для React key: у строки нет стабильного id до сохранения
  key: string
  subject: string
  startsAt: string
  endsAt: string
}

// день недели (1-6) -> уроки в порядке проведения
export type Days = Record<number, LessonDraft[]>
