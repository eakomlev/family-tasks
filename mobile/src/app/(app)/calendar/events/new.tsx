import { useLocalSearchParams } from 'expo-router'
import { EventFormScreen } from '@/features/calendar/EventFormScreen'

export default function NewEvent() {
  const { date, view } = useLocalSearchParams<{ date?: string; view?: string }>()
  return <EventFormScreen date={date} view={view} />
}
