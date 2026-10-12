import { CoinIcon } from '@/components/CoinBalance'
import { useIdentity } from '@/identity/context'
import { coinsWord } from '@/lib/coins'
import { useGetCoinsEarnedQuery } from '@/store/coins'
import { startOfDayIso } from '../../utils'
import { Amount, Banner, Text } from './styles'
import type { EarnedTodayProps } from './types'

// Сколько монет ребёнок заработал сегодня; блока нет, пока заработано 0 (и у родителей).
export function EarnedToday({ now }: EarnedTodayProps) {
  const { identity } = useIdentity()
  const isChild = identity?.role === 'child'
  // пересчёт при смене дня, а не каждую минуту обновления времени
  const since = startOfDayIso(now)

  // монеты начислили или забрали (награда за задание, реакция родителя): сигнал `members` сбрасывает кэш, и сумма пересчитывается
  const { data } = useGetCoinsEarnedQuery(since, { skip: !isChild })
  const earned = data?.earned ?? 0

  if (!isChild || earned <= 0) return null

  return (
    <Banner to="/coins" aria-label={`Сегодня заработано: ${coinsWord(earned)}. Открыть историю`}>
      <CoinIcon />
      <Text>
        Сегодня заработано
        <Amount>+{coinsWord(earned)}</Amount>
      </Text>
    </Banner>
  )
}
