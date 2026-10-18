import { useLocalSearchParams } from 'expo-router'
import { GoalsListScreen } from '@/features/goals/GoalsListScreen'

export default function MemberGoals() {
  const { memberId } = useLocalSearchParams<{ memberId: string }>()
  return <GoalsListScreen memberId={memberId} />
}
