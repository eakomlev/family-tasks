import { useLocalSearchParams } from 'expo-router'
import { EventViewScreen } from '@/features/calendar/EventViewScreen'

export default function Event() {
  const { id, tab } = useLocalSearchParams<{ id: string; tab?: string }>()
  return <EventViewScreen id={id} tab={tab} />
}
