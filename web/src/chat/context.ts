import { createContext, useContext } from 'react'
import type { ChatsContextValue } from './types'

export const ChatsContext = createContext<ChatsContextValue | null>(null)

export function useChats() {
  const ctx = useContext(ChatsContext)
  if (!ctx) throw new Error('useChats must be used inside ChatsProvider')
  return ctx
}
