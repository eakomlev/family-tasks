import { THEME_ORDER, type ThemePreference } from '@/lib/theme'
import type { ThemeOptions } from './types'

export const THEME_OPTIONS: ThemeOptions = {
  system: { icon: '🖥️', label: 'Как в системе' },
  light: { icon: '☀️', label: 'Светлая' },
  dark: { icon: '🌙', label: 'Тёмная' },
}

export function nextPreference(current: ThemePreference): ThemePreference {
  return THEME_ORDER[(THEME_ORDER.indexOf(current) + 1) % THEME_ORDER.length]
}
