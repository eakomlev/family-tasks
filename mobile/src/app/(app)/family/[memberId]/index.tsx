import { useLocalSearchParams } from 'expo-router'
import { MemberScreen } from '@/features/family/MemberScreen'

export default function Member() {
  const { memberId } = useLocalSearchParams<{ memberId: string }>()
  return <MemberScreen memberId={memberId} />
}
