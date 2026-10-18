import { useLocalSearchParams } from 'expo-router'
import { TrainingsScreen } from '@/features/schedule/TrainingsScreen'

export default function MemberTrainings() {
  const { memberId } = useLocalSearchParams<{ memberId: string }>()
  return <TrainingsScreen memberId={memberId} />
}
