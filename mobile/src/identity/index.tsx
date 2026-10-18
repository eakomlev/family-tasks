import { useCallback, useEffect, useState, type ReactNode } from 'react'
import * as SecureStore from 'expo-secure-store'
import { IdentityContext } from './context'
import type { Identity } from './types'

const KEY = 'identity'

// Токен сессии лежит в защищённом хранилище системы (Keychain на iPhone, Keystore на Android), а не в обычном кэше
export function IdentityProvider({ children, fallback = null }: { children: ReactNode; fallback?: ReactNode }) {
  // undefined — ещё читаем из хранилища
  const [identity, setIdentity] = useState<Identity | null | undefined>(undefined)

  useEffect(() => {
    SecureStore.getItemAsync(KEY)
      .then((raw) => setIdentity(raw ? (JSON.parse(raw) as Identity) : null))
      .catch(() => setIdentity(null))
  }, [])

  const save = useCallback(async (value: Identity) => {
    await SecureStore.setItemAsync(KEY, JSON.stringify(value))
    setIdentity(value)
  }, [])

  const clear = useCallback(async () => {
    await SecureStore.deleteItemAsync(KEY)
    setIdentity(null)
  }, [])

  // пока читаем данные входа, показываем заставку, а не пустой экран
  if (identity === undefined) return fallback

  return <IdentityContext value={{ identity, save, clear }}>{children}</IdentityContext>
}
