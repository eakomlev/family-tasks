export interface TrainingDraft {
  // для React key: у строки нет стабильного id до сохранения
  key: string
  title: string
  place: string
  startsAt: string
  endsAt: string
}

// день недели (1-7) -> тренировки в порядке проведения
export type Days = Record<number, TrainingDraft[]>
