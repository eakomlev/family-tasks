import { createContext, useContext } from 'react'
import type { IdentityContextValue } from './types'

export const IdentityContext = createContext<IdentityContextValue | null>(null)

export function useIdentity() {
  const ctx = useContext(IdentityContext)
  if (!ctx) throw new Error('useIdentity must be used inside IdentityProvider')
  return ctx
}
