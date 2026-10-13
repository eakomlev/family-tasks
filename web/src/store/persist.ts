// Сохранение кэша RTK Query в localStorage. Свой слой вместо redux-persist: нужно читать данные синхронно при старте (чтобы первый кадр
// уже был с данными), хранить отдельно по пользователям, ограничивать размер и срок.

// поднимите, если изменилась форма сохраняемых данных: старый кэш будет выброшен
export const CACHE_VERSION = 2
export const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000
export const MAX_BYTES = 2_500_000

const PREFIX = 'family-tasks:cache:'
const OWNER_KEY = `${PREFIX}owner`

interface QueryEntry {
  status: string
  fulfilledTimeStamp?: number
  [key: string]: unknown
}

interface ProvidedState {
  tags: Record<string, Record<string, string[]>>
  keys: Record<string, unknown[]>
}

// то, что отдаётся RTK Query при загрузке: записи запросов и какие теги они обеспечивают
export interface PersistedApi {
  queries: Record<string, QueryEntry>
  provided: ProvidedState
  mutations: Record<string, never>
  subscriptions: Record<string, never>
  config: Record<string, never>
}

interface Stored {
  v: number
  savedAt: number
  api: PersistedApi
}

const userKey = (memberId: string) => `${PREFIX}${memberId}`

function storage(): Storage | undefined {
  try {
    return typeof localStorage === 'undefined' ? undefined : localStorage
  } catch {
    return undefined
  }
}

// Из состояния api оставляет то, что стоит сохранять: успешные запросы не старше срока, самые свежие в пределах бюджета размера.
export function snapshot(state: { queries?: Record<string, unknown>; provided?: ProvidedState } | undefined, now = Date.now()): PersistedApi {
  const all = Object.entries((state?.queries ?? {}) as Record<string, QueryEntry | undefined>)
    .filter(([, q]) => q?.status === 'fulfilled' && typeof q.fulfilledTimeStamp === 'number' && now - q.fulfilledTimeStamp < MAX_AGE_MS)
    .sort(([, a], [, b]) => (b!.fulfilledTimeStamp ?? 0) - (a!.fulfilledTimeStamp ?? 0))

  const queries: Record<string, QueryEntry> = {}
  let bytes = 0
  for (const [key, entry] of all) {
    const size = JSON.stringify(entry).length
    if (bytes + size > MAX_BYTES) continue
    bytes += size
    queries[key] = entry as QueryEntry
  }

  const keep = new Set(Object.keys(queries))
  const provided: ProvidedState = { tags: {}, keys: {} }
  for (const [key, tags] of Object.entries(state?.provided?.keys ?? {})) if (keep.has(key)) provided.keys[key] = tags
  for (const [type, ids] of Object.entries(state?.provided?.tags ?? {})) {
    for (const [id, keys] of Object.entries(ids)) {
      const kept = keys.filter((k) => keep.has(k))
      if (kept.length > 0) (provided.tags[type] ??= {})[id] = kept
    }
  }
  return { queries, provided, mutations: {}, subscriptions: {}, config: {} }
}

function removeOthers(store: Storage, memberId: string) {
  const keep = new Set([userKey(memberId), OWNER_KEY])
  const stale: string[] = []
  for (let i = 0; i < store.length; i++) {
    const key = store.key(i)
    if (key?.startsWith(PREFIX) && !keep.has(key)) stale.push(key)
  }
  stale.forEach((key) => store.removeItem(key))
}

// Сохраняет кэш пользователя. Ошибка квоты не должна ломать приложение: пробуем освободить место и работаем дальше без кэша.
export function saveCache(memberId: string, apiState: Parameters<typeof snapshot>[0], now = Date.now()): boolean {
  const store = storage()
  if (!store) return false
  const payload: Stored = { v: CACHE_VERSION, savedAt: now, api: snapshot(apiState, now) }
  try {
    // на устройстве лежит кэш только текущего пользователя: чужие записи (остались от прошлого входа) стираем
    removeOthers(store, memberId)
    store.setItem(userKey(memberId), JSON.stringify(payload))
    store.setItem(OWNER_KEY, memberId)
    return true
  } catch {
    try {
      store.removeItem(userKey(memberId))
    } catch {
      /* хранилище недоступно */
    }
    return false
  }
}

// Читает сохранённый кэш последнего пользователя (синхронно, при создании хранилища). Чужая версия или просроченный кэш выбрасываются.
export function loadCache(now = Date.now()): { memberId: string; api: PersistedApi } | undefined {
  const store = storage()
  if (!store) return undefined
  try {
    const memberId = store.getItem(OWNER_KEY)
    if (!memberId) return undefined
    const raw = store.getItem(userKey(memberId))
    if (!raw) return undefined
    const parsed = JSON.parse(raw) as Stored
    if (parsed.v !== CACHE_VERSION || typeof parsed.savedAt !== 'number' || now - parsed.savedAt > MAX_AGE_MS) {
      store.removeItem(userKey(memberId))
      return undefined
    }
    return { memberId, api: snapshot(parsed.api, now) }
  } catch {
    return undefined
  }
}

// Стирает сохранённое: при выходе, ответе 401 и смене пользователя
export function clearCache() {
  const store = storage()
  if (!store) return
  try {
    const keys: string[] = []
    for (let i = 0; i < store.length; i++) {
      const key = store.key(i)
      if (key?.startsWith(PREFIX)) keys.push(key)
    }
    keys.forEach((key) => store.removeItem(key))
  } catch {
    /* не критично */
  }
}
