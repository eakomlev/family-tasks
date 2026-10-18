import { BackLink } from '@/components/BackLink'
import { Chip } from '@/components/Chip'
import { Screen } from '@/components/Screen'
import { Stack } from '@/components/Stack'
import { Text, Title } from '@/components/Text'
import { setThemePreference, THEME_ORDER, useThemePreference, type ThemePreference } from '@/theme/preference'

const LABELS: Record<ThemePreference, string> = { system: 'Как в системе', light: 'Светлая', dark: 'Тёмная' }

// Тема приложения: как в системе, светлая или тёмная
export function ThemeScreen() {
  const preference = useThemePreference()
  return (
    <Screen bottomReserve={88}>
      <BackLink fallback="/profile">← Профиль</BackLink>
      <Title>Тема</Title>
      <Text $tone="muted">«Как в системе» следует за настройкой телефона.</Text>
      <Stack $gap={8}>
        {THEME_ORDER.map((option) => (
          <Chip key={option} active={preference === option} onPress={() => setThemePreference(option)}>
            {LABELS[option]}
          </Chip>
        ))}
      </Stack>
    </Screen>
  )
}
