import { View } from 'react-native'
import styled from 'styled-components/native'
import { Button } from '@/components/Button'
import { Chip } from '@/components/Chip'
import { PageHeader } from '@/components/PageHeader'
import { Screen } from '@/components/Screen'
import { Slider } from '@/components/Slider'
import { Stack } from '@/components/Stack'
import { Heading, Text } from '@/components/Text'
import { FONT_SCALE_DEFAULT, FONT_SCALE_MAX, FONT_SCALE_MIN, FONT_SCALE_STEP, setFontScale, useFontScale } from '@/theme/fontScale'
import { setThemePreference, THEME_ORDER, useThemePreference, type ThemePreference } from '@/theme/preference'

const LABELS: Record<ThemePreference, string> = { system: 'Как в системе', light: 'Светлая', dark: 'Тёмная' }

const Card = styled.View`
  gap: 12px;
  padding: 16px;
  border-radius: ${({ theme }) => theme.radiusCard}px;
  border-width: 1px;
  border-color: ${({ theme }) => theme.colors.cardBorder};
  background-color: ${({ theme }) => theme.colors.surface};
`

// Оформление: тема (как в системе, светлая или тёмная) и размер шрифта на одном экране; всё запоминается на устройстве
export function ThemeScreen() {
  const preference = useThemePreference()
  const scale = useFontScale()
  return (
    <Screen header={<PageHeader fallback="/profile">Оформление</PageHeader>}>
      <Heading>Тема</Heading>
      <Text $tone="muted">«Как в системе» следует за настройкой телефона.</Text>
      <Stack $gap={8}>
        {THEME_ORDER.map((option) => (
          <Chip key={option} active={preference === option} onPress={() => setThemePreference(option)}>
            {LABELS[option]}
          </Chip>
        ))}
      </Stack>

      <Heading>Размер шрифта</Heading>
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Text $size={14} $weight="bold">
            А
          </Text>
          <View style={{ flex: 1 }}>
            <Slider value={scale} min={FONT_SCALE_MIN} max={FONT_SCALE_MAX} step={FONT_SCALE_STEP} onChange={setFontScale} accessibilityLabel="Размер шрифта" />
          </View>
          <Text $size={24} $weight="bold">
            А
          </Text>
        </View>
        <Text $tone="muted" $size={13} style={{ textAlign: 'center' }}>{`${Math.round(scale * 100)}%`}</Text>
      </Card>
      <Card>
        <Text $weight="extraBold">Так будет выглядеть текст</Text>
        <Text $tone="muted">Задания, чаты, календарь и остальные экраны меняются сразу. Настройка хранится на этом устройстве.</Text>
      </Card>
      {scale !== FONT_SCALE_DEFAULT && (
        <Button variant="text" onPress={() => setFontScale(FONT_SCALE_DEFAULT)}>
          Вернуть стандартный размер
        </Button>
      )}
    </Screen>
  )
}
