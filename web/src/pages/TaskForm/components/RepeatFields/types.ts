import type { RepeatType } from '@/api'

export interface RepeatFieldsProps {
  disabled: boolean
  repeatType: RepeatType
  days: number[]
  until: string
  min: string
  onTypeChange: (type: RepeatType) => void
  onToggleDay: (day: number) => void
  onUntilChange: (until: string) => void
}
