import type { RepeatType } from '@/api'

// значения полей формы (всё строками, как в полях ввода)
export interface FormState {
  title: string
  assigneeId: string
  date: string
  time: string
  repeatType: RepeatType
  days: number[]
  until: string
}
