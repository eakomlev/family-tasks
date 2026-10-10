import type { Role } from '@/lib/roles'

export interface Member {
  id: string
  name: string
  role: Role
  isOwner: boolean
}

export interface Link {
  code: string
  expiresAt: string
}

export interface SessionResult {
  family: { code: string }
  member: Member & { token: string }
}

export interface SignupData {
  role: Role
  name: string
  email: string
  code: string
}

export type CodePurpose = 'signup' | 'login'

export interface LoginOption {
  id: string
  name: string
  role: Role
  familyCode: string
  familyMembers: string[]
}
