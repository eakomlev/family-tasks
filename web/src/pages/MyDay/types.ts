import type { ViewTraining } from '@/components/TrainingViewList/types'

export interface Greeting {
  text: string
  icon: string
}

export interface LessonDay {
  // 1 = понедельник ... 6 = суббота
  weekday: number
  // «сегодня», «завтра» или «в понедельник»
  label: string
}

export interface TrainingDay {
  // 1 = понедельник ... 7 = воскресенье
  weekday: number
  // «сегодня», «завтра», «в среду» или «через неделю»
  label: string
  trainings: ViewTraining[]
}
