import { configureStore } from '@reduxjs/toolkit'
import { setupListeners } from '@reduxjs/toolkit/query'
import { api, hydrateCache } from './api'
import { cacheReducer, hydrated } from './cache'
import { loadCache, saveCache } from './persist'

// задержка записи в localStorage: серия обновлений даёт одну запись
const SAVE_DELAY_MS = 1000

// Собирает хранилище. При старте синхронно подгружает сохранённый кэш, чтобы первый кадр уже был с данными.
export function makeStore({ hydrate = true }: { hydrate?: boolean } = {}) {
  const store = configureStore({
    reducer: { [api.reducerPath]: api.reducer, cache: cacheReducer },
    middleware: (getDefault) => getDefault().concat(api.middleware),
  })

  if (hydrate) {
    const loaded = loadCache()
    if (loaded) {
      store.dispatch(hydrateCache(loaded.api))
      store.dispatch(hydrated(loaded.memberId))
    }
  }
  return store
}

// Запись кэша в localStorage при изменениях (с задержкой) и при уходе со страницы. Пока неизвестно, кто вошёл, не пишет.
export function attachPersistence(store: ReturnType<typeof makeStore>, delayMs = SAVE_DELAY_MS) {
  let timer: ReturnType<typeof setTimeout> | undefined
  const flush = () => {
    clearTimeout(timer)
    timer = undefined
    const state = store.getState()
    if (state.cache.owner) saveCache(state.cache.owner, state.api)
  }
  const unsubscribe = store.subscribe(() => {
    if (!store.getState().cache.owner || timer) return
    timer = setTimeout(flush, delayMs)
  })
  const onHide = () => document.visibilityState === 'hidden' && flush()
  if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onHide)
  if (typeof window !== 'undefined') window.addEventListener('pagehide', flush)
  return () => {
    unsubscribe()
    clearTimeout(timer)
    if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onHide)
    if (typeof window !== 'undefined') window.removeEventListener('pagehide', flush)
  }
}

export const store = makeStore()
attachPersistence(store)
// возврат на вкладку и появление сети обновляют активные запросы (refetchOnFocus и refetchOnReconnect в api.ts)
setupListeners(store.dispatch)

export type AppStore = ReturnType<typeof makeStore>
export type RootState = ReturnType<AppStore['getState']>
export type AppDispatch = AppStore['dispatch']
