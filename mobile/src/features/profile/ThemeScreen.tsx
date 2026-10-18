import { PageHeader } from '@/components/PageHeader'
import { Chip } from '@/components/Chip'
import { Screen } from '@/components/Screen'
import { Stack } from '@/components/Stack'
import { Text } from '@/components/Text'
import { setThemePreference, THEME_ORDER, useThemePreference, type ThemePreference } from '@/theme/preference'

const LABELS: Record<ThemePreference, string> = { system: 'Как в системе', light: 'Светлая', dark: 'Тёмная' }

// Тема приложения: как в системе, светлая или тёмная
export function ThemeScreen() {
  const preference = useThemePreference()
  return (
    <Screen header={<PageHeader fallback="/profile">Тема</PageHeader>}>
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
