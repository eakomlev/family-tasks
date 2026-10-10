import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { del, get, set } from 'idb-keyval'
import type { Role } from './roles'

// то, что хранится на устройстве: код семьи, роль и секретный токен участника
export interface Identity {
  familyCode: string
  memberId: string
  name: string
  role: Role
  token: string
}

const KEY = 'identity'

interface IdentityContextValue {
  identity: Identity | null
  save: (identity: Identity) => Promise<void>
  clear: () => Promise<void>
}

const IdentityContext = createContext<IdentityContextValue | null>(null)

export function IdentityProvider({ children }: { children: ReactNode }) {
  // undefined — ещё читаем из IndexedDB
  const [identity, setIdentity] = useState<Identity | null | undefined>(undefined)

  useEffect(() => {
    get<Identity>(KEY)
      .then((value) => setIdentity(value ?? null))
      .catch(() => setIdentity(null))
  }, [])

  const save = useCallback(async (value: Identity) => {
    await set(KEY, value)
    setIdentity(value)
  }, [])

  const clear = useCallback(async () => {
    await del(KEY)
    setIdentity(null)
  }, [])

  if (identity === undefined) return null

  return <IdentityContext value={{ identity, save, clear }}>{children}</IdentityContext>
}

export function useIdentity() {
  const ctx = useContext(IdentityContext)
  if (!ctx) throw new Error('useIdentity must be used inside IdentityProvider')
  return ctx
}
