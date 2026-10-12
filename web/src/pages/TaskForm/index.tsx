import { useEffect, useState } from 'react'
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ApiError, createTask, deleteTask, getTask, updateTask, type Task, type TaskInput } from '@/api'
import { BackLink } from '@/components/BackLink'
import { Notice } from '@/components/Notice'
import { SlideInPage as Page } from '@/components/Page'
import { useIdentity } from '@/identity/context'
import { useProfile } from '@/profile/context'
import { TaskEditor } from './components/TaskEditor'
import { emptyForm, fromTask } from './utils'

// /tasks/new — создание; /tasks/:taskId/edit — изменение своего задания (чужое только смотрят, на /tasks/:taskId)
export default function TaskForm() {
  const { taskId } = useParams()
  // ?assignee=<id>: исполнитель, выбранный заранее (например, в фильтре списка заданий)
  const [params] = useSearchParams()
  const preselected = params.get('assignee')
  const navigate = useNavigate()
  const { identity } = useIdentity()
  const { data } = useProfile()

  const [task, setTask] = useState<Task>()
  const [state, setState] = useState<'loading' | 'ready' | 'missing' | 'failed'>('loading')

  const token = identity?.token
  const me = identity?.memberId

  useEffect(() => {
    if (!token || !taskId) return
    let cancelled = false
    getTask(token, taskId)
      .then((res) => {
        if (cancelled) return
        setTask(res.task)
        setState('ready')
      })
      .catch((err) => {
        if (cancelled) return
        setState(err instanceof ApiError && err.status === 404 ? 'missing' : 'failed')
      })
    return () => { cancelled = true }
  }, [token, taskId])

  if (!token || !me) return null
  const members = data?.members ?? []
  if (state === 'missing') return <Navigate to="/tasks" replace />
  // изменять может только автор
  if (task && task.authorId !== me) return <Navigate to={`/tasks/${task.id}`} replace />

  async function create(input: TaskInput) {
    await createTask(token!, input)
    navigate('/tasks', { replace: true })
  }

  async function update(input: TaskInput) {
    await updateTask(token!, task!.id, input)
    navigate(`/tasks/${task!.id}`, { replace: true })
  }

  async function remove() {
    await deleteTask(token!, task!.id)
    navigate('/tasks', { replace: true })
  }

  return (
    <Page>
      <BackLink to={taskId ? `/tasks/${taskId}` : '/tasks'}>{taskId ? '← Задание' : '← Задания'}</BackLink>
      <h1>{taskId ? 'Изменить задание' : 'Новое задание'}</h1>

      {!taskId && members.length > 0 && (
        <TaskEditor initial={emptyForm(members.some((m) => m.id === preselected) ? preselected! : me)} members={members} me={me} submitLabel="Создать" onSubmit={create} />
      )}

      {taskId && state === 'loading' && <p>Загрузка…</p>}
      {taskId && state === 'failed' && <Notice $tone="error">Не удалось загрузить задание. Проверьте соединение.</Notice>}
      {task && state === 'ready' && members.length > 0 && (
        // key: при переходе между заданиями форма начинает с чистого состояния
        <TaskEditor key={task.id} initial={fromTask(task)} members={members} me={me} submitLabel="Сохранить" onSubmit={update} onDelete={remove} />
      )}
    </Page>
  )
}
