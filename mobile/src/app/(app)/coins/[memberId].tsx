import { useLocalSearchParams } from 'expo-router'
import { CoinsScreen } from '@/features/coins/CoinsScreen'

// Монеты выбранного ребёнка (для родителей)
export default function MemberCoins() {
  const { memberId } = useLocalSearchParams<{ memberId: string }>()
  return <CoinsScreen memberId={memberId} />
}
