import { useLocalSearchParams } from 'expo-router'
import { EventDeleteScreen } from '@/features/calendar/EventDeleteScreen'

export default function DeleteEvent() {
  const { id } = useLocalSearchParams<{ id: string }>()
  return <EventDeleteScreen id={id} />
}
