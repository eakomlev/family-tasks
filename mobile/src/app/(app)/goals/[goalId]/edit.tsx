import { useLocalSearchParams } from 'expo-router'
import { GoalFormScreen } from '@/features/goals/GoalFormScreen'

export default function EditGoal() {
  const { goalId } = useLocalSearchParams<{ goalId: string }>()
  return <GoalFormScreen goalId={goalId} />
}
