import { Pressable, View } from 'react-native'
import { useRouter } from 'expo-router'
import styled from 'styled-components/native'
import { CoinIcon } from '@/components/Coins'
import { Text } from '@/components/Text'
import { useIdentity } from '@/identity/context'
import { coinsWord } from '@/lib/coins'
import { useGetCoinsEarnedQuery } from '@/store/coins'
import { startOfDayIso } from './utils'

const Banner = styled.View`
  flex-direction: row;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border-radius: 18px;
  background-color: ${({ theme }) => theme.colors.coinBg};
`

// Сколько монет ребёнок заработал сегодня; блока нет, пока заработано 0 (и у взрослых)
export function EarnedToday({ now }: { now: Date }) {
  const { identity } = useIdentity()
  const router = useRouter()
  const isChild = identity?.role === 'child'
  // пересчёт при смене дня, а не каждую минуту обновления времени
  const since = startOfDayIso(now)

  // монеты начислили или забрали: сигнал `members` сбрасывает кэш, и сумма пересчитывается
  const { data } = useGetCoinsEarnedQuery(since, { skip: !isChild })
  const earned = data?.earned ?? 0
  if (!isChild || earned <= 0) return null

  return (
    <Pressable onPress={() => router.push('/coins')} accessibilityRole="button" accessibilityLabel={`Сегодня заработано: ${coinsWord(earned)}. Открыть историю`}>
      <Banner>
        <CoinIcon size={30} />
        <View>
          <Text $size={13} style={{ color: '#7a4b00' }}>
            Сегодня заработано
          </Text>
          <Text $weight="black" $size={18} style={{ color: '#7a4b00' }}>{`+${coinsWord(earned)}`}</Text>
        </View>
      </Banner>
    </Pressable>
  )
}
