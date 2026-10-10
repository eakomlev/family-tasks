import { useState } from 'react'
import { Stack } from '@/components/Stack'
import { applyPreference, readPreference, type ThemePreference } from '@/lib/theme'
import { Icon, Option, Options } from './styles'
import { THEME_OPTIONS } from './utils'

export function ThemeSetting() {
  const [preference, setPreference] = useState<ThemePreference>(readPreference)

  function choose(value: ThemePreference) {
    applyPreference(value)
    setPreference(value)
  }

  return (
    <Stack as="section">
      <h2>Тема оформления</h2>
      <Options role="radiogroup" aria-label="Тема оформления">
        {THEME_OPTIONS.map((option) => (
          <Option
            key={option.value}
            type="button"
            role="radio"
            aria-checked={preference === option.value}
            $active={preference === option.value}
            onClick={() => choose(option.value)}
          >
            <Icon aria-hidden>{option.icon}</Icon>
            {option.label}
          </Option>
        ))}
      </Options>
    </Stack>
  )
}
