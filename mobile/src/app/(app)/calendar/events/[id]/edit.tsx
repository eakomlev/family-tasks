import { useLocalSearchParams } from 'expo-router'
import { EventFormScreen } from '@/features/calendar/EventFormScreen'

export default function EditEvent() {
  const { id } = useLocalSearchParams<{ id: string }>()
  return <EventFormScreen id={id} />
}
