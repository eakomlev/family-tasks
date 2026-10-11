import { useEffect, useState } from 'react'
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ApiError, completeTask, getTask, uncompleteTask, type Occurrence, type Task } from '@/api'
import { Avatar } from '@/components/Avatar'
import { BackLink } from '@/components/BackLink'
import { Button } from '@/components/Button'
import { Celebration } from '@/components/Celebration'
import { Notice } from '@/components/Notice'
import { Page } from '@/components/Page'
import { useIdentity } from '@/identity/context'
import { coinsWord } from '@/lib/coins'
import { formatDateTime, todayIso } from '@/lib/date'
import { useNow } from '@/lib/useNow'
import { useProfile } from '@/profile/context'
import { useLive } from '@/realtime/context'
import { Actions, Description, Details, Who } from './styles'
import { describeFullRepeat, describeOccurrenceDue } from './utils'

// Просмотр задания: все детали и, внизу, отметка о выполнении (после неё экран поздравления).
// ?date=YYYY-MM-DD выбирает вхождение повторяющегося задания.
export default function TaskView() {
  const { taskId } = useParams()
  const [params] = useSearchParams()
  const date = params.get('date')
  const navigate = useNavigate()
  const { identity } = useIdentity()
  const { data } = useProfile()
  const today = todayIso(useNow())

  const [task, setTask] = useState<Task>()
  const [occurrence, setOccurrence] = useState<Occurrence | null>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'missing' | 'failed'>('loading')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()
  const [celebrating, setCelebrating] = useState(false)
  const [version, setVersion] = useState(0)
  useLive(['tasks'], () => setVersion((v) => v + 1))

  const token = identity?.token
  const me = identity?.memberId

  useEffect(() => {
    if (!token || !taskId) return
    let cancelled = false
    getTask(token, taskId, date)
      .then((res) => {
        if (cancelled) return
        setTask(res.task)
        setOccurrence(res.occurrence)
        setState('ready')
      })
      .catch((err) => {
        if (cancelled) return
        setState(err instanceof ApiError && err.status === 404 ? 'missing' : 'failed')
      })
    return () => { cancelled = true }
  }, [token, taskId, date, version])

  if (!token || !me) return null
  if (state === 'missing') return <Navigate to="/tasks" replace />

  const members = data?.members ?? []
  const byId = (id: string) => members.find((m) => m.id === id)
  const done = occurrence?.done ?? null
  const late = !done && occurrence?.date != null && occurrence.date < today

  async function toggle() {
    if (!task || !occurrence) return
    setBusy(true)
    setError(undefined)
    try {
      if (done) {
        await uncompleteTask(token!, task.id, occurrence.date)
        setOccurrence({ ...occurrence, done: null })
      } else {
        await completeTask(token!, task.id, occurrence.date)
        setOccurrence({ ...occurrence, done: { memberId: me!, at: new Date().toISOString() } })
        setCelebrating(true)
      }
    } catch {
      setError('Не удалось изменить отметку. Попробуйте ещё раз.')
    } finally {
      setBusy(false)
    }
  }

  const person = (id: string) => {
    const member = byId(id)
    return member ? (
      <Who>
        <Avatar name={member.name} seed={member.id} src={member.avatar} size="1.4rem" />
        {member.id === me ? `${member.name} (я)` : member.name}
      </Who>
    ) : '—'
  }
  const repeat = task ? describeFullRepeat(task) : ''

  return (
    <Page>
      <BackLink to="/tasks">← Задания</BackLink>
      {state === 'loading' && <p>Загрузка…</p>}
      {state === 'failed' && <Notice $tone="error">Не удалось загрузить задание. Проверьте соединение.</Notice>}

      {task && state === 'ready' && (
        <>
          <h1>{task.title}</h1>
          {done && (
            <Notice $tone="muted">
              ✓ Выполнено: {byId(done.memberId)?.name ?? 'участник семьи'}, {formatDateTime(done.at)}
            </Notice>
          )}
          {late && <Notice $tone="error">Просрочено</Notice>}

          {task.description && <Description>{task.description}</Description>}

          <Details>
            <dt>Исполнитель</dt>
            <dd>{person(task.assigneeId)}</dd>
            <dt>Автор</dt>
            <dd>{person(task.authorId)}</dd>
            <dt>Срок</dt>
            <dd>{describeOccurrenceDue(task, occurrence)}</dd>
            {repeat && (
              <>
                <dt>Повтор</dt>
                <dd>{repeat}</dd>
              </>
            )}
            {task.reward > 0 && (
              <>
                <dt>Награда</dt>
                <dd>{coinsWord(task.reward)}</dd>
              </>
            )}
            <dt>Создано</dt>
            <dd>{formatDateTime(task.createdAt)}</dd>
          </Details>

          {error && <Notice $tone="error">{error}</Notice>}
          <Actions>
            {task.authorId === me && <Button as={Link} to={`/tasks/${task.id}/edit`}>Изменить</Button>}
            {occurrence && (
              <Button $variant={done ? undefined : 'primary'} type="button" disabled={busy} onClick={toggle}>
                {done ? 'Снять отметку о выполнении' : 'Отметить выполненным'}
              </Button>
            )}
          </Actions>

          {celebrating && <Celebration title={task.title} reward={task.assigneeId === me ? task.reward : undefined} onClose={() => navigate('/tasks', { replace: true })} />}
        </>
      )}
    </Page>
  )
}
