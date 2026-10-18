import type { RepeatType } from '@/api'

// значения полей формы (всё строками, как в полях ввода)
export interface FormState {
  title: string
  description: string
  // награда монетами числом в строке ('0' или '' — без награды): поле «Другая» вводится как текст
  reward: string
  // выбрана плашка «Другая»
  rewardCustom: boolean
  // «Указать время»: у задания есть дата (а с ней время и повтор); без галочки задание «без срока»
  scheduled: boolean
  assigneeId: string
  date: string
  time: string
  repeatType: RepeatType
  days: number[]
  until: string
}
