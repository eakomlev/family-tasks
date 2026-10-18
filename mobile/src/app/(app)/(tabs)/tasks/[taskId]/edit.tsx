import { useLocalSearchParams } from 'expo-router'
import { TaskFormScreen } from '@/features/tasks/TaskFormScreen'

export default function EditTask() {
  const { taskId } = useLocalSearchParams<{ taskId: string }>()
  return <TaskFormScreen taskId={taskId} />
}
