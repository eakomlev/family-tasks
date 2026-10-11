import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { del, get, set } from 'idb-keyval'
import { Splash } from '@/components/Splash'
import { IdentityContext } from './context'
import type { Identity } from './types'

const KEY = 'identity'

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

  // пока читаем данные входа, показываем загрузку, а не пустой экран
  if (identity === undefined) return <Splash />

  return <IdentityContext value={{ identity, save, clear }}>{children}</IdentityContext>
}
