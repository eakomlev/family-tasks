import { useEffect } from 'react'
import { useStore } from 'react-redux'
import { useIdentity } from '@/identity/context'
import { api } from './api'
import { ownerChanged, reset } from './cache'
import { clearCache } from './persist'
import { setSession } from './session'
import type { AppStore } from './index'

// Связывает вход и кэш: токен для запросов, чей это кэш, очистка при выходе и смене пользователя.
// Кэш другого пользователя на общем устройстве показывать нельзя ни одного кадра дольше, чем нужно для чтения входа.
export function SessionSync() {
  const { identity } = useIdentity()
  const store = useStore() as AppStore
  const token = identity?.token
  const memberId = identity?.memberId

  useEffect(() => {
    const { cache } = store.getState()
    if (token && memberId) {
      setSession({ token, memberId })
      // загруженный при старте кэш чужой: выбрасываем его целиком
      if (cache.hydratedFor && cache.hydratedFor !== memberId) {
        store.dispatch(api.util.resetApiState())
        store.dispatch(reset())
        clearCache()
      }
      store.dispatch(ownerChanged(memberId))
      return
    }
    // вышли (или входа нет): стираем всё, что было
    setSession(undefined)
    store.dispatch(api.util.resetApiState())
    store.dispatch(reset())
    clearCache()
  }, [store, token, memberId])

  return null
}
