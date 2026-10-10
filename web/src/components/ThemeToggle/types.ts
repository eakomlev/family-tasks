import type { ThemePreference } from '@/lib/theme'

export interface ThemeOption {
  icon: string
  label: string
}

export type ThemeOptions = Record<ThemePreference, ThemeOption>
