import { View } from 'react-native'
import { REWARD_CHOICES } from '@/lib/coins'
import { Chip } from '../Chip'
import { Input } from '../Input'
import { Text } from '../Text'

const DEFAULT_HINT = 'Ребёнок получит монеты, когда задание будет выполнено. У повторяющегося задания за каждое выполнение.'

interface CoinPickerProps {
  // число монет строкой: поле «Другая» вводится как текст
  value: string
  // выбрана плашка «Другая»
  custom: boolean
  onChange: (value: string, custom: boolean) => void
  title?: string
  zeroLabel?: string
  hint?: string
}

// Выбор числа монет: готовые плашки и «Другая» с полем для своего числа от 1 до 1000
export function CoinPicker({ value, custom, onChange, title = 'Награда, монет', zeroLabel = 'Без награды', hint = DEFAULT_HINT }: CoinPickerProps) {
  return (
    <View style={{ gap: 8 }}>
      <Text $weight="extraBold" $size={14} $tone="muted">
        {title}
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {REWARD_CHOICES.map((n) => {
          const active = !custom && Number(value) === n
          return (
            <Chip key={n} active={active} onPress={() => onChange(String(n), false)}>
              {n === 0 ? zeroLabel : String(n)}
            </Chip>
          )
        })}
        <Chip active={custom} onPress={() => onChange(custom ? value : '', true)}>
          Другая
        </Chip>
      </View>
      {custom && (
        <Input
          value={value}
          onChangeText={(text) => onChange(text.replace(/\D/g, '').slice(0, 4), true)}
          keyboardType="number-pad"
          placeholder="От 1 до 1000"
          accessibilityLabel="Своя награда, монет"
          autoFocus
        />
      )}
      <Text $size={13} $tone="muted">
        {hint}
      </Text>
    </View>
  )
}
