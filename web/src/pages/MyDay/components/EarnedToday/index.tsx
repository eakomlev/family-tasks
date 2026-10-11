import { useEffect, useState } from 'react'
import { getCoinsEarned } from '@/api'
import { CoinIcon } from '@/components/CoinBalance'
import { useIdentity } from '@/identity/context'
import { coinsWord } from '@/lib/coins'
import { useLive } from '@/realtime/context'
import { startOfDayIso } from '../../utils'
import { Amount, Banner, Text } from './styles'
import type { EarnedTodayProps } from './types'

// Сколько монет ребёнок заработал сегодня; блока нет, пока заработано 0 (и у родителей).
export function EarnedToday({ now }: EarnedTodayProps) {
  const { identity } = useIdentity()
  const [earned, setEarned] = useState(0)
  const [version, setVersion] = useState(0)
  // монеты начислили или забрали (награда за задание, реакция родителя): считаем заново
  useLive(['members'], () => setVersion((v) => v + 1))

  const token = identity?.token
  const isChild = identity?.role === 'child'
  // пересчёт при смене дня, а не каждую минуту обновления времени
  const since = startOfDayIso(now)

  useEffect(() => {
    if (!token || !isChild) return
    let cancelled = false
    getCoinsEarned(token, since)
      .then((res) => !cancelled && setEarned(res.earned))
      .catch(() => {})
    return () => { cancelled = true }
  }, [token, isChild, since, version])

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
