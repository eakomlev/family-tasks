import { useLocalSearchParams } from 'expo-router'
import { LessonReportScreen } from '@/features/lessonReport/LessonReportScreen'

export default function LessonReport() {
  const { subject } = useLocalSearchParams<{ subject?: string }>()
  return <LessonReportScreen subject={subject} />
}
