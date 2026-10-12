import { CoinBalanceCard } from '@/components/CoinBalance'
import { useIdentity } from '@/identity/context'
import { useGetCoinBalanceQuery } from '@/store/coins'

// Баланс монет ребёнка на его странице, для родителей; нажатие открывает историю начислений.
// Пока баланс не загрузился (или не удалось), строки нет.
export function ChildCoins({ memberId }: { memberId: string }) {
  const { identity } = useIdentity()
  // монеты начислили или забрали: сигнал `members` сбрасывает кэш, баланс обновляется сам
  const { data: coins } = useGetCoinBalanceQuery(memberId, { skip: !identity })

  if (coins === undefined) return null
  return <CoinBalanceCard coins={coins} to={`/coins/${memberId}`} />
}
