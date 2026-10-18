import { useSyncExternalStore } from 'react'
import { getKv } from '@/lib/kv'

// Выбор темы: как в системе, светлая или тёмная. Хранится на устройстве; менять можно из профиля.
export type ThemePreference = 'system' | 'light' | 'dark'

export const THEME_ORDER: ThemePreference[] = ['system', 'light', 'dark']

const KEY = 'theme'
const listeners = new Set<() => void>()
let current: ThemePreference | undefined

function read(): ThemePreference {
  try {
    const value = getKv().getItem(KEY)
    return value === 'light' || value === 'dark' ? value : 'system'
  } catch {
    return 'system'
  }
}

export function getThemePreference(): ThemePreference {
  current ??= read()
  return current
}

export function setThemePreference(preference: ThemePreference) {
  current = preference
  try {
    if (preference === 'system') getKv().removeItem(KEY)
    else getKv().setItem(KEY, preference)
  } catch {
    /* без хранилища тема просто не запомнится */
  }
  listeners.forEach((listener) => listener())
}

const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export const useThemePreference = () => useSyncExternalStore(subscribe, getThemePreference, () => 'system' as const)

// только для тестов: сбросить запомненное в памяти
export function resetThemePreference() {
  current = undefined
}
