import { Redirect, useRouter } from 'expo-router'
import type { TaskInput } from '@/api'
import { PageHeader } from '@/components/PageHeader'
import { Notice } from '@/components/Notice'
import { Screen } from '@/components/Screen'
import { Text } from '@/components/Text'
import { useIdentity } from '@/identity/context'
import { goBack } from '@/lib/navigation'
import { useProfile } from '@/profile/context'
import { toApiError } from '@/store/api'
import { useCreateTaskMutation, useDeleteTaskMutation, useGetTaskQuery, useUpdateTaskMutation } from '@/store/tasks'
import { emptyForm, fromTask } from './formUtils'
import { TaskEditor } from './TaskEditor'

// Создание (без taskId) и изменение своего задания (чужое только смотрят, на странице задания).
// `assignee`: исполнитель, выбранный заранее (например, в фильтре списка заданий).
export function TaskFormScreen({ taskId, assignee }: { taskId?: string; assignee?: string }) {
  const router = useRouter()
  const { identity } = useIdentity()
  const { data } = useProfile()

  const token = identity?.token
  const me = identity?.memberId

  // задание для изменения: из кэша сразу, свежее следом
  const query = useGetTaskQuery({ id: taskId ?? '' }, { skip: !token || !taskId })
  const task = query.data?.task
  const error = query.error
  const missing = !!error && 'status' in error && error.status === 404
  const state: 'loading' | 'ready' | 'missing' | 'failed' = task ? 'ready' : missing ? 'missing' : error ? 'failed' : 'loading'
  const [createTask] = useCreateTaskMutation()
  const [updateTask] = useUpdateTaskMutation()
  const [deleteTask] = useDeleteTaskMutation()

  if (!token || !me) return null
  const members = data?.members ?? []
  if (state === 'missing') return <Redirect href="/tasks" />
  // изменять может только автор
  if (task && task.authorId !== me) return <Redirect href={{ pathname: '/tasks/[taskId]', params: { taskId: task.id } }} />

  async function create(input: TaskInput) {
    await createTask(input).unwrap().catch(toApiError)
    goBack(router, '/tasks')
  }

  async function update(input: TaskInput) {
    await updateTask({ id: task!.id, input }).unwrap().catch(toApiError)
    goBack(router, { pathname: '/tasks/[taskId]', params: { taskId: task!.id } })
  }

  async function remove() {
    await deleteTask(task!.id).unwrap().catch(toApiError)
    // задания больше нет: возвращаемся на список, минуя его страницу
    router.dismissTo('/tasks')
  }

  return (
    <Screen>
      <PageHeader fallback="/tasks">{taskId ? 'Изменить задание' : 'Новое задание'}</PageHeader>

      {!taskId && members.length > 0 && (
        <TaskEditor initial={emptyForm(members.some((m) => m.id === assignee) ? assignee! : me)} members={members} me={me} submitLabel="Создать" onSubmit={create} />
      )}

      {taskId && state === 'loading' && <Text $tone="muted">Загрузка…</Text>}
      {taskId && state === 'failed' && <Notice tone="error">Не удалось загрузить задание. Проверьте соединение.</Notice>}
      {task && state === 'ready' && members.length > 0 && (
        // key: при переходе между заданиями форма начинает с чистого состояния
        <TaskEditor key={task.id} initial={fromTask(task)} members={members} me={me} submitLabel="Сохранить" onSubmit={update} onDelete={remove} />
      )}
    </Screen>
  )
}
