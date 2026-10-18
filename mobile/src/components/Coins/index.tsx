import { Pressable, View } from 'react-native'
import { useRouter, type Href } from 'expo-router'
import Svg, { Circle, Path } from 'react-native-svg'
import styled from 'styled-components/native'
import { Text } from '../Text'

// Монета: золотой кружок с ободком и звездой. Рисунок цветной (монета остаётся монетой в любой теме).
export function CoinIcon({ size = 22 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx="12" cy="12" r="10" fill="#fbbf24" stroke="#d97706" strokeWidth="1.6" />
      <Circle cx="12" cy="12" r="6.6" fill="none" stroke="#d97706" strokeWidth="1.1" opacity="0.7" />
      <Path d="m12 8.2 1.15 2.45 2.65.35-1.95 1.85.5 2.65L12 14.2l-2.35 1.3.5-2.65-1.95-1.85 2.65-.35z" fill="#d97706" />
    </Svg>
  )
}

const Pill = styled.View`
  flex-direction: row;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: 999px;
  background-color: ${({ theme }) => theme.colors.coinBg};
`

// Баланс ребёнка: монета и число, нажатие открывает историю
export function CoinBalance({ coins }: { coins: number }) {
  const router = useRouter()
  return (
    <Pressable onPress={() => router.push('/coins')} accessibilityRole="button" accessibilityLabel={`Монеты: ${coins}. Открыть историю`}>
      <Pill>
        <CoinIcon size={20} />
        <Text $weight="black" $size={15} style={{ color: '#7a4b00' }}>
          {String(coins)}
        </Text>
      </Pill>
    </Pressable>
  )
}

const Row = styled.View`
  flex-direction: row;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  border-radius: ${({ theme }) => theme.radiusCard}px;
  border-width: 1px;
  border-color: ${({ theme }) => theme.colors.cardBorder};
  background-color: ${({ theme }) => theme.colors.surface};
`

// Строка с балансом для профиля ребёнка: монета, подпись, число; ведёт на историю начислений
export function CoinBalanceCard({ coins, to }: { coins: number; to: Href }) {
  const router = useRouter()
  return (
    <Pressable onPress={() => router.push(to)} accessibilityRole="button" accessibilityLabel={`Монеты: ${coins}. Открыть историю`}>
      <Row>
        <CoinIcon size={28} />
        <Text $weight="extraBold" style={{ flex: 1 }}>
          Монеты
        </Text>
        <Text $weight="black" $size={20}>
          {String(coins)}
        </Text>
        <View>
          <Text $tone="muted">›</Text>
        </View>
      </Row>
    </Pressable>
  )
}
