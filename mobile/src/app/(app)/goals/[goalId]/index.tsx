import { useLocalSearchParams } from 'expo-router'
import { GoalViewScreen } from '@/features/goals/GoalViewScreen'

export default function Goal() {
  const { goalId } = useLocalSearchParams<{ goalId: string }>()
  return <GoalViewScreen goalId={goalId} />
}
