// Синхронное хранилище «ключ — строка» на устройстве (MMKV): кэш данных нужно читать при старте без ожидания, чтобы первый кадр
// уже был с данными. Секреты (токен сессии) сюда не кладём, для них SecureStore (`identity/`).
export interface KeyValueStore {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
  keys(): string[]
}

export function memoryStore(): KeyValueStore {
  const map = new Map<string, string>()
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => void map.set(key, value),
    removeItem: (key) => void map.delete(key),
    keys: () => [...map.keys()],
  }
}

function mmkvStore(): KeyValueStore {
  // подключаем при первом обращении: в тестах (Node) нативного модуля нет, там хранилище в памяти
  const { createMMKV } = require('react-native-mmkv') as typeof import('react-native-mmkv')
  const mmkv = createMMKV({ id: 'family-tasks' })
  return {
    getItem: (key) => mmkv.getString(key) ?? null,
    setItem: (key, value) => mmkv.set(key, value),
    removeItem: (key) => void mmkv.remove(key),
    keys: () => mmkv.getAllKeys(),
  }
}

let current: KeyValueStore | undefined

export function getKv(): KeyValueStore {
  if (current) return current
  try {
    current = mmkvStore()
  } catch {
    current = memoryStore()
  }
  return current
}

// только для тестов: подменить хранилище
export function setKv(store: KeyValueStore | undefined) {
  current = store
}
