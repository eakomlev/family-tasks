import { useLocalSearchParams } from 'expo-router'
import { LessonsScreen } from '@/features/schedule/LessonsScreen'

export default function MemberSchedule() {
  const { memberId } = useLocalSearchParams<{ memberId: string }>()
  return <LessonsScreen memberId={memberId} />
}
