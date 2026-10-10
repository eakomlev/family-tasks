import { useEffect, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { ApiError, createTask, deleteTask, getTask, updateTask, type Task, type TaskInput } from '@/api'
import { BackLink } from '@/components/BackLink'
import { Notice } from '@/components/Notice'
import { Page } from '@/components/Page'
import { useIdentity } from '@/identity/context'
import { useProfile } from '@/profile/context'
import { TaskDetails } from './components/TaskDetails'
import { TaskEditor } from './components/TaskEditor'
import { emptyForm, fromTask } from './utils'

// /tasks/new — создание; /tasks/:taskId — изменение своего задания или просмотр чужого
export default function TaskForm() {
  const { taskId } = useParams()
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

  async function create(input: TaskInput) {
    await createTask(token!, input)
    navigate('/tasks', { replace: true })
  }

  async function update(input: TaskInput) {
    await updateTask(token!, task!.id, input)
    navigate('/tasks', { replace: true })
  }

  async function remove() {
    await deleteTask(token!, task!.id)
    navigate('/tasks', { replace: true })
  }

  const byId = (id: string) => members.find((m) => m.id === id)

  return (
    <Page>
      <BackLink to="/tasks">← Задания</BackLink>
      <h1>{!taskId ? 'Новое задание' : task && task.authorId !== me ? task.title : 'Задание'}</h1>

      {!taskId && members.length > 0 && (
        <TaskEditor initial={emptyForm(me)} members={members} me={me} submitLabel="Создать" onSubmit={create} />
      )}

      {taskId && state === 'loading' && <p>Загрузка…</p>}
      {taskId && state === 'failed' && <Notice $tone="error">Не удалось загрузить задание. Проверьте соединение.</Notice>}
      {task && state === 'ready' && members.length > 0 &&
        (task.authorId === me ? (
          // key: при переходе между заданиями форма начинает с чистого состояния
          <TaskEditor key={task.id} initial={fromTask(task)} members={members} me={me} submitLabel="Сохранить" onSubmit={update} onDelete={remove} />
        ) : (
          <TaskDetails task={task} author={byId(task.authorId)} assignee={byId(task.assigneeId)} />
        ))}
    </Page>
  )
}
