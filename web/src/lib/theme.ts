export type ThemePreference = 'system' | 'light' | 'dark'

export const THEME_ORDER: ThemePreference[] = ['system', 'light', 'dark']

const STORAGE_KEY = 'theme'

// цвет строки состояния браузера: совпадает с --bg в GlobalStyle
const THEME_COLORS = { light: '#f1f4ff', dark: '#0b0e1f' }

export function readPreference(): ThemePreference {
  try {
    const value = localStorage.getItem(STORAGE_KEY)
    return value === 'light' || value === 'dark' ? value : 'system'
  } catch {
    return 'system'
  }
}

export function resolveTheme(): 'light' | 'dark' {
  const forced = document.documentElement.dataset.theme
  if (forced === 'light' || forced === 'dark') return forced
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function syncThemeColor() {
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', THEME_COLORS[resolveTheme()])
}

// не вызываем до первого рендера: начальное значение выставляет скрипт в index.html
export function applyPreference(preference: ThemePreference) {
  const root = document.documentElement
  if (preference === 'system') delete root.dataset.theme
  else root.dataset.theme = preference

  try {
    if (preference === 'system') localStorage.removeItem(STORAGE_KEY)
    else localStorage.setItem(STORAGE_KEY, preference)
  } catch {
    /* без localStorage тема просто не запомнится */
  }
  syncThemeColor()
}
