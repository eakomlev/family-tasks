import { useLocalSearchParams } from 'expo-router'
import { GoalFormScreen } from '@/features/goals/GoalFormScreen'

export default function NewGoal() {
  const { memberId } = useLocalSearchParams<{ memberId: string }>()
  return <GoalFormScreen memberId={memberId} />
}
