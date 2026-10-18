import { Image, Pressable, View } from 'react-native'
import { useRouter } from 'expo-router'
import Svg, { Path } from 'react-native-svg'
import styled, { useTheme } from 'styled-components/native'
import type { Goal } from '@/api'
import { CoinIcon } from '@/components/Coins'
import { Text } from '@/components/Text'

const Frame = styled.View<{ $size: number }>`
  width: ${({ $size }) => $size}px;
  height: ${({ $size }) => $size}px;
  border-radius: 18px;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  background-color: ${({ theme }) => theme.colors.accentSoft};
`

const Bought = styled.View`
  position: absolute;
  bottom: 6px;
  align-self: center;
  padding: 2px 8px;
  border-radius: 999px;
  background-color: ${({ theme }) => theme.colors.lime};
`

// Картинка цели; без неё значок подарка. У купленной на картинке бейдж «Куплено».
export function GoalImage({ goal, large }: { goal: Pick<Goal, 'image' | 'title' | 'purchasedAt'>; large?: boolean }) {
  const { colors } = useTheme()
  const size = large ? 220 : 72
  return (
    <Frame $size={size} style={large ? { alignSelf: 'center' } : undefined}>
      {goal.image ? (
        <Image source={{ uri: goal.image }} style={{ width: size, height: size }} accessibilityLabel={large ? goal.title : undefined} />
      ) : (
        <Svg width={size * 0.5} height={size * 0.5} viewBox="0 0 24 24" fill="none" stroke={colors.accent} strokeWidth={1.6} strokeLinejoin="round">
          <Path d="M4 10h16v10H4zM3 7h18v3H3zM12 7v13" />
          <Path d="M12 7C10 3.5 6.5 4 7 6s3 1 5 1zM12 7c2-3.5 5.5-3 5-1s-3 1-5 1z" />
        </Svg>
      )}
      {goal.purchasedAt && (
        <Bought>
          <Text $weight="black" $size={12} style={{ color: colors.onLime }}>
            Куплено
          </Text>
        </Bought>
      )}
    </Frame>
  )
}

const Card = styled.View`
  flex-direction: row;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border-radius: ${({ theme }) => theme.radiusCard}px;
  border-width: 1px;
  border-color: ${({ theme }) => theme.colors.cardBorder};
  background-color: ${({ theme }) => theme.colors.surface};
`

const Track = styled.View`
  height: 8px;
  border-radius: 4px;
  overflow: hidden;
  background-color: ${({ theme }) => theme.colors.track};
`

// Карточка цели в списке: картинка, название, цена и полоса накопленного; нажатие открывает цель
export function GoalCard({ goal, balance }: { goal: Goal; balance?: number }) {
  const router = useRouter()
  const bought = goal.purchasedAt !== null
  return (
    <Pressable onPress={() => router.push({ pathname: '/goals/[goalId]', params: { goalId: goal.id } })} accessibilityRole="button">
      <Card>
        <GoalImage goal={goal} />
        <View style={{ flex: 1, gap: 4 }}>
          <Text $weight="extraBold">{goal.title}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <CoinIcon size={18} />
            <Text $weight="black" $size={15}>
              {String(goal.price)}
            </Text>
          </View>
          {!bought && balance !== undefined && (
            <Track accessibilityLabel={`Накоплено ${Math.max(0, Math.min(balance, goal.price))} из ${goal.price}`}>
              <View style={{ width: `${Math.round(Math.max(0, Math.min(1, balance / goal.price)) * 100)}%`, height: 8, backgroundColor: colorsLime() }} />
            </Track>
          )}
        </View>
        <Text $tone="muted" $size={20}>
          ›
        </Text>
      </Card>
    </Pressable>
  )
}

// цвет полосы накопленного: лайм «Квеста» одинаков в обеих темах
const colorsLime = () => '#c4f04a'
