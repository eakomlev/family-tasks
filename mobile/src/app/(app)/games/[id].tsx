import { useLocalSearchParams } from 'expo-router'
import { GameScreen } from '@/features/games/GameScreen'

// key: у каждой игры своё состояние экрана
export default function Game() {
  const { id } = useLocalSearchParams<{ id: string }>()
  return <GameScreen key={id} id={id} />
}
