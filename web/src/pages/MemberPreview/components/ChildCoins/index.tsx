import { useEffect, useState } from 'react'
import { getCoinBalance } from '@/api'
import { CoinBalanceCard } from '@/components/CoinBalance'
import { useIdentity } from '@/identity/context'
import { useLive } from '@/realtime/context'

// Баланс монет ребёнка на его странице, для родителей; нажатие открывает историю начислений.
// Пока баланс не загрузился (или не удалось), строки нет.
export function ChildCoins({ memberId }: { memberId: string }) {
  const { identity } = useIdentity()
  const [coins, setCoins] = useState<number>()
  const [version, setVersion] = useState(0)
  // монеты начислили или забрали: баланс обновляется сам
  useLive(['members'], () => setVersion((v) => v + 1))

  const token = identity?.token
  useEffect(() => {
    if (!token) return
    let cancelled = false
    getCoinBalance(token, memberId)
      .then((balance) => !cancelled && setCoins(balance))
      .catch(() => {})
    return () => { cancelled = true }
  }, [token, memberId, version])

  if (coins === undefined) return null
  return <CoinBalanceCard coins={coins} to={`/coins/${memberId}`} />
}
