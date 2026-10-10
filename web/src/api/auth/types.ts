import type { Role } from '@/lib/roles'

export type CodePurpose = 'signup' | 'login'

// вариант выбора, если email состоит в нескольких семьях
export interface LoginOption {
  id: string
  name: string
  role: Role
  familyCode: string
  familyMembers: string[]
}
