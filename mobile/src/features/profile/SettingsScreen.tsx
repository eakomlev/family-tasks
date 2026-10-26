import { useState } from 'react'
import { View } from 'react-native'
import { Button } from '@/components/Button'
import { Checkbox } from '@/components/Checkbox'
import { isGameSoundOn, setGameSoundOn } from '@/features/games/gameSound'
import { PageHeader } from '@/components/PageHeader'
import { Screen } from '@/components/Screen'
import { Slider } from '@/components/Slider'
import { Heading, Text } from '@/components/Text'
import { FONT_SCALE_DEFAULT, FONT_SCALE_MAX, FONT_SCALE_MIN, FONT_SCALE_STEP, setFontScale, useFontScale } from '@/theme/fontScale'
import styled from 'styled-components/native'

const Card = styled.View`
  gap: 12px;
  padding: 16px;
  border-radius: ${({ theme }) => theme.radiusCard}px;
  border-width: 1px;
  border-color: ${({ theme }) => theme.colors.cardBorder};
  background-color: ${({ theme }) => theme.colors.surface};
`

// Настройки приложения на этом устройстве. Размер шрифта (меняет все тексты сразу) и звуки в играх; всё запоминается на устройстве.
export function SettingsScreen() {
  const scale = useFontScale()
  const [gameSound, setGameSound] = useState(isGameSoundOn)
  return (
    <Screen header={<PageHeader fallback="/profile">Настройки</PageHeader>}>
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
      <Heading>Звуки</Heading>
      <Card>
        <Checkbox
          checked={gameSound}
          onChange={(on) => {
            setGameSound(on)
            setGameSoundOn(on)
          }}
        >
          Звуки в играх (ходы, взятия, шах)
        </Checkbox>
      </Card>
      {scale !== FONT_SCALE_DEFAULT && (
        <Button variant="text" onPress={() => setFontScale(FONT_SCALE_DEFAULT)}>
          Вернуть стандартный размер
        </Button>
      )}
    </Screen>
  )
}
