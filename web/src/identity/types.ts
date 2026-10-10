import type { Role } from '@/lib/roles'

// то, что хранится на устройстве: код семьи, роль и секретный токен участника
export interface Identity {
  familyCode: string
  memberId: string
  name: string
  role: Role
  token: string
}

export interface IdentityContextValue {
  identity: Identity | null
  save: (identity: Identity) => Promise<void>
  clear: () => Promise<void>
}
