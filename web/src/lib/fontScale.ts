// Размер шрифта приложения: множитель от стандартного, хранится на устройстве. Весь интерфейс в rem, поэтому достаточно размера корня.
export const MIN_FONT_SCALE = 0.8
export const MAX_FONT_SCALE = 1.5
export const FONT_SCALE_STEP = 0.05
const KEY = 'fontScale'

export function clampFontScale(value: number): number {
  if (!Number.isFinite(value)) return 1
  const stepped = Math.round(value / FONT_SCALE_STEP) * FONT_SCALE_STEP
  return Math.round(Math.min(MAX_FONT_SCALE, Math.max(MIN_FONT_SCALE, stepped)) * 100) / 100
}

export function getFontScale(): number {
  try {
    const raw = localStorage.getItem(KEY)
    return raw === null ? 1 : clampFontScale(Number(raw))
  } catch {
    return 1
  }
}

// Применяет размер к странице; стандартный сбрасывает собственное значение корня
export function applyFontScale(scale: number): void {
  document.documentElement.style.fontSize = scale === 1 ? '' : `${scale * 100}%`
}

export function setFontScale(scale: number): number {
  const value = clampFontScale(scale)
  try {
    if (value === 1) localStorage.removeItem(KEY)
    else localStorage.setItem(KEY, String(value))
  } catch {
    /* хранилища нет — размер действует до перезагрузки */
  }
  applyFontScale(value)
  return value
}
