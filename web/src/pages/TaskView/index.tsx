import { useEffect, useRef, useState } from 'react'
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ApiError, type Occurrence, type Task } from '@/api'
import { Avatar } from '@/components/Avatar'
import { BackLink } from '@/components/BackLink'
import { Button } from '@/components/Button'
import { Celebration } from '@/components/Celebration'
import { Notice } from '@/components/Notice'
import { SlideInPage as Page } from '@/components/Page'
import { useIdentity } from '@/identity/context'
import { coinsWord } from '@/lib/coins'
import { formatDateTime, todayIso } from '@/lib/date'
import { useNow } from '@/lib/useNow'
import { useProfile } from '@/profile/context'
import { toApiError } from '@/store/api'
import { useCompleteTaskMutation, useConfirmTaskMutation, useGetTaskQuery, useUncompleteTaskMutation } from '@/store/tasks'
import { Actions, Description, Details, Who } from './styles'
import { describeFullRepeat, describeOccurrenceDue } from './utils'
import { useInFlight } from '@/lib/useInFlight'

// Просмотр задания: все детали и, внизу, отметка о выполнении (после неё экран поздравления).
// ?date=YYYY-MM-DD выбирает вхождение повторяющегося задания.
// отдельной функцией: время берётся в момент нажатия, а не при отрисовке
const nowIso = () => new Date().toISOString()

export default function TaskView() {
  const guard = useInFlight()
  const { taskId } = useParams()
  const [params] = useSearchParams()
  const date = params.get('date')
  const navigate = useNavigate()
  const { identity } = useIdentity()
  const { data } = useProfile()
  const today = todayIso(useNow())

  const token = identity?.token
  const me = identity?.memberId

  // задание из кэша сразу (в том числе сохранённого на устройстве), свежее приходит следом и после каждого сигнала сокета
  const query = useGetTaskQuery({ id: taskId ?? '', date }, { skip: !token || !taskId })
  const fetched = query.data
  // после отметки показываем результат сразу, не дожидаясь повторного запроса; пришли новые данные, и поверх них уже они
  const [override, setOverride] = useState<{ base: typeof fetched; value: Occurrence | null }>()
  const task: Task | undefined = fetched?.task
  const occurrence: Occurrence | null = override && override.base === fetched ? override.value : (fetched?.occurrence ?? null)
  const setOccurrence = (value: Occurrence | null) => setOverride({ base: fetched, value })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()
  const [celebrating, setCelebrating] = useState(false)
  const [completeTask] = useCompleteTaskMutation()
  const [uncompleteTask] = useUncompleteTaskMutation()
  const [confirmTask] = useConfirmTaskMutation()
  // прежнее состояние вхождения: по нему видно, что задание, ожидавшее проверки, только что подтвердили.
  // Берётся только из данных, полученных с сервера за эту сессию: сохранённое на устройстве с прошлого раза поздравления не вызывает
  const previous = useRef<Occurrence | null>(null)
  const openedAt = useRef(0)
  useEffect(() => {
    openedAt.current = Date.now()
  }, [])
  const fulfilledAt = query.fulfilledTimeStamp
  useEffect(() => {
    if (!fetched || !fulfilledAt || fulfilledAt < openedAt.current) return
    // родитель подтвердил то, что ждало проверки, пока ребёнок смотрит на страницу: поздравляем его с наградой
    if (previous.current?.pending && fetched.occurrence?.done && fetched.task.reward > 0 && fetched.task.assigneeId === me) {
      // oxlint-disable-next-line react/set-state-in-effect -- реакция на пришедшие с сервера данные, а не вычисляемое значение
      setCelebrating(true)
    }
    previous.current = fetched.occurrence
  }, [fetched, fulfilledAt, me])

  const queryError = query.error
  const state: 'loading' | 'ready' | 'missing' | 'failed' =
    task ? 'ready' : queryError && 'status' in queryError && queryError.status === 404 ? 'missing' : queryError ? 'failed' : 'loading'

  if (!token || !me) return null
  if (state === 'missing') return <Navigate to="/tasks" replace />

  const members = data?.members ?? []
  const byId = (id: string) => members.find((m) => m.id === id)
  const done = occurrence?.done ?? null
  const pending = occurrence?.pending ?? null
  const late = !done && !pending && occurrence?.date != null && occurrence.date < today
  const isChild = identity?.role === 'child'
  // ребёнок задание с наградой только отправляет на проверку, подтверждает родитель
  const needsReview = !!task && task.reward > 0 && isChild

  // Действие над вхождением; результат применяется сразу, а подтверждённый запрос обновит и остальных по сокету.
  const act = guard(async (kind: 'complete' | 'confirm' | 'undo') => {
    if (!task || !occurrence) return
    setBusy(true)
    setError(undefined)
    const now = nowIso()
    try {
      if (kind === 'undo') {
        await uncompleteTask({ id: task.id, date: occurrence.date }).unwrap().catch(toApiError)
        setOccurrence({ ...occurrence, done: null, pending: null })
      } else if (kind === 'confirm') {
        await confirmTask({ id: task.id, date: occurrence.date }).unwrap().catch(toApiError)
        setOccurrence({ ...occurrence, done: { memberId: pending?.memberId ?? me!, at: now }, pending: null })
      } else {
        await completeTask({ id: task.id, date: occurrence.date }).unwrap().catch(toApiError)
        if (needsReview) {
          // отправлено на проверку: праздника пока нет, он будет после подтверждения
          setOccurrence({ ...occurrence, pending: { memberId: me!, at: now } })
        } else {
          setOccurrence({ ...occurrence, done: { memberId: me!, at: now } })
          setCelebrating(true)
        }
      }
    } catch (err) {
      setError(err instanceof ApiError && err.code === 'confirmed' ? 'Подтверждённое задание может отменить только родитель.' : 'Не удалось выполнить. Попробуйте ещё раз.')
    } finally {
      setBusy(false)
    }
  })

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
          {pending && (
            <Notice $tone="warning">
              На проверке: {byId(pending.memberId)?.name ?? 'участник семьи'} отправил(а) {formatDateTime(pending.at)}.{' '}
              {isChild
                ? `Родители проверят, и вы получите ${coinsWord(task.reward)}.`
                : `Подтвердите, и ${byId(task.assigneeId)?.name ?? 'исполнитель'} получит ${coinsWord(task.reward)}.`}
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
            {occurrence && !done && !pending && (
              <Button $variant="primary" type="button" disabled={busy} onClick={() => void act('complete')}>
                {needsReview ? 'Отправить на проверку' : 'Отметить выполненным'}
              </Button>
            )}
            {occurrence && pending && !isChild && (
              <>
                <Button $variant="primary" type="button" disabled={busy} onClick={() => void act('confirm')}>
                  Подтвердить{task.reward > 0 ? `: +${coinsWord(task.reward)}` : ''}
                </Button>
                <Button type="button" disabled={busy} onClick={() => void act('undo')}>Вернуть на доработку</Button>
              </>
            )}
            {occurrence && pending && isChild && (
              <Button type="button" disabled={busy} onClick={() => void act('undo')}>Отменить отправку</Button>
            )}
            {/* подтверждённое задание с наградой ребёнок снять не может */}
            {occurrence && done && !needsReview && (
              <Button type="button" disabled={busy} onClick={() => void act('undo')}>Снять отметку о выполнении</Button>
            )}
          </Actions>

          {celebrating && <Celebration title={task.title} reward={task.assigneeId === me ? task.reward : undefined} onClose={() => navigate('/tasks', { replace: true })} />}
        </>
      )}
    </Page>
  )
}
