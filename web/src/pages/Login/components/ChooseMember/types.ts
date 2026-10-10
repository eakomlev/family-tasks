import type { LoginOption } from '@/api'

export interface ChooseMemberProps {
  options: LoginOption[]
  busy: boolean
  error?: string
  onChoose: (memberId: string) => void
}
