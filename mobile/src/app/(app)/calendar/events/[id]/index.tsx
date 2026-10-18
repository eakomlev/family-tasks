import { useLocalSearchParams } from 'expo-router'
import { EventViewScreen } from '@/features/calendar/EventViewScreen'

export default function Event() {
  const { id } = useLocalSearchParams<{ id: string }>()
  return <EventViewScreen id={id} />
}
