import { useLocalSearchParams } from 'expo-router'
import { TaskFormScreen } from '@/features/tasks/TaskFormScreen'

export default function NewTask() {
  const { assignee } = useLocalSearchParams<{ assignee?: string }>()
  return <TaskFormScreen assignee={assignee} />
}
