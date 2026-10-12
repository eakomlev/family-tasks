import type { ThemePreference } from '@/lib/theme'

export const THEME_OPTIONS: { value: ThemePreference; icon: string; label: string }[] = [
  { value: 'system', icon: '🖥️', label: 'Как в системе' },
  { value: 'light', icon: '☀️', label: 'Светлая' },
  { value: 'dark', icon: '🌙', label: 'Тёмная' },
]
