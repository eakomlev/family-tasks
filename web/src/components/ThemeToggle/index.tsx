import { useEffect, useState } from 'react'
import { applyPreference, readPreference, syncThemeColor, type ThemePreference } from '@/lib/theme'
import { Toggle } from './styles'
import { nextPreference, THEME_OPTIONS } from './utils'

// переключает «как в системе» → светлая → тёмная
export function ThemeToggle() {
  const [preference, setPreference] = useState<ThemePreference>(readPreference)

  // в режиме «как в системе» следим за сменой системной темы
  useEffect(() => {
    if (preference !== 'system') return
    const query = window.matchMedia('(prefers-color-scheme: dark)')
    query.addEventListener('change', syncThemeColor)
    return () => query.removeEventListener('change', syncThemeColor)
  }, [preference])

  function handleClick() {
    const next = nextPreference(preference)
    applyPreference(next)
    setPreference(next)
  }

  const { icon, label } = THEME_OPTIONS[preference]

  return (
    <Toggle type="button" onClick={handleClick} title={`Тема: ${label}`} aria-label={`Тема: ${label}. Нажмите, чтобы сменить`}>
      <span aria-hidden>{icon}</span>
    </Toggle>
  )
}
