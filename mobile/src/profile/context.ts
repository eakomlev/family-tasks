import { createContext, useContext } from 'react'
import type { ProfileContextValue } from './types'

export const ProfileContext = createContext<ProfileContextValue | null>(null)

export function useProfile() {
  const ctx = useContext(ProfileContext)
  if (!ctx) throw new Error('useProfile must be used inside ProfileProvider')
  return ctx
}
