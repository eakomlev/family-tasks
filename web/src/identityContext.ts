import { createContext, useContext } from 'react'
import type { Role } from './roles'

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

export const IdentityContext = createContext<IdentityContextValue | null>(null)

export function useIdentity() {
  const ctx = useContext(IdentityContext)
  if (!ctx) throw new Error('useIdentity must be used inside IdentityProvider')
  return ctx
}
