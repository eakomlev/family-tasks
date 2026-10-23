import { useLocalSearchParams } from 'expo-router'
import { GamesListScreen } from '@/features/games/GamesListScreen'

export default function MemberGames() {
  const { memberId } = useLocalSearchParams<{ memberId: string }>()
  return <GamesListScreen memberId={memberId} />
}
