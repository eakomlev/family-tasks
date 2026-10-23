import { useSyncExternalStore } from 'react'
import { getKv } from '@/lib/kv'

// Размер шрифта приложения: множитель ко всем размерам текста (1 — как задумано). Хранится на устройстве; менять можно в «Настройках» профиля.
export const FONT_SCALE_MIN = 0.8
export const FONT_SCALE_MAX = 1.5
export const FONT_SCALE_STEP = 0.05
export const FONT_SCALE_DEFAULT = 1

const KEY = 'fontScale'
const listeners = new Set<() => void>()
let current: number | undefined

// Значение в допустимых пределах и кратное шагу (испорченное или чужое значение превращается в стандартное)
export function normalizeFontScale(value: unknown): number {
  const number = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN
  if (!Number.isFinite(number)) return FONT_SCALE_DEFAULT
  const clamped = Math.min(FONT_SCALE_MAX, Math.max(FONT_SCALE_MIN, number))
  return Number((Math.round(clamped / FONT_SCALE_STEP) * FONT_SCALE_STEP).toFixed(2))
}

function read(): number {
  try {
    return normalizeFontScale(getKv().getItem(KEY))
  } catch {
    return FONT_SCALE_DEFAULT
  }
}

export function getFontScale(): number {
  current ??= read()
  return current
}

export function setFontScale(value: number) {
  const next = normalizeFontScale(value)
  if (next === getFontScale()) return
  current = next
  try {
    if (next === FONT_SCALE_DEFAULT) getKv().removeItem(KEY)
    else getKv().setItem(KEY, String(next))
  } catch {
    /* без хранилища размер просто не запомнится */
  }
  listeners.forEach((listener) => listener())
}

const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export const useFontScale = () => useSyncExternalStore(subscribe, getFontScale, () => FONT_SCALE_DEFAULT)

// только для тестов: сбросить запомненное в памяти
export function resetFontScale() {
  current = undefined
}
