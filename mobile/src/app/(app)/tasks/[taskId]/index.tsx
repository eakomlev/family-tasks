import { useEffect, useRef, useState } from 'react'
import { View } from 'react-native'
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router'
import { ApiError, type Occurrence, type Task } from '@/api'
import { Avatar } from '@/components/Avatar'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/Button'
import { Notice } from '@/components/Notice'
import { Screen } from '@/components/Screen'
import { Stack } from '@/components/Stack'
import { Text } from '@/components/Text'
import { Celebration } from '@/features/tasks/Celebration'
import { describeFullRepeat, describeOccurrenceDue } from '@/features/tasks/viewText'
import { useIdentity } from '@/identity/context'
import { coinsWord } from '@/lib/coins'
import { formatDateTime, todayIso } from '@/lib/date'
import { isParent } from '@/lib/roles'
import { useInFlight } from '@/lib/useInFlight'
import { useNow } from '@/lib/useNow'
import { goBack } from '@/lib/navigation'
import { useProfile } from '@/profile/context'
import { toApiError } from '@/store/api'
import { useCompleteTaskMutation, useConfirmTaskMutation, useGetTaskQuery, useUncompleteTaskMutation } from '@/store/tasks'

// отдельной функцией: время берётся в момент нажатия, а не при отрисовке
const nowIso = () => new Date().toISOString()

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', gap: 12 }}>
      <Text $tone="muted" style={{ width: 110 }}>
        {label}
      </Text>
      <View style={{ flex: 1 }}>{typeof children === 'string' ? <Text>{children}</Text> : children}</View>
    </View>
  )
}

// Просмотр задания: все детали и внизу отметка о выполнении (после неё экран поздравления).
// ?date=YYYY-MM-DD выбирает вхождение повторяющегося задания.
export default function TaskView() {
  const guard = useInFlight()
  const router = useRouter()
  const { taskId, date } = useLocalSearchParams<{ taskId: string; date?: string }>()
  const { identity } = useIdentity()
  const { data } = useProfile()
  const today = todayIso(useNow())

  const token = identity?.token
  const me = identity?.memberId

  // задание из кэша сразу, свежее приходит следом и после каждого сигнала сокета
  const query = useGetTaskQuery({ id: taskId ?? '', date: date ?? null }, { skip: !token || !taskId })
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

  // Прежнее состояние вхождения: по нему видно, что задание, ожидавшее проверки, только что подтвердили.
  // Берётся только из данных, полученных с сервера за эту сессию: сохранённое на устройстве с прошлого раза поздравления не вызывает.
  const previous = useRef<Occurrence | null>(null)
  const openedAt = useRef(0)
  useEffect(() => {
    openedAt.current = Date.now()
  }, [])
  const fulfilledAt = query.fulfilledTimeStamp
  useEffect(() => {
    if (!fetched || !fulfilledAt || fulfilledAt < openedAt.current) return
    // родитель подтвердил то, что ждало проверки, пока ребёнок смотрит на экран: поздравляем его с наградой
    if (previous.current?.pending && fetched.occurrence?.done && fetched.task.reward > 0 && fetched.task.assigneeId === me) {
      setCelebrating(true)
    }
    previous.current = fetched.occurrence
  }, [fetched, fulfilledAt, me])

  const queryError = query.error
  const state: 'loading' | 'ready' | 'missing' | 'failed' =
    task ? 'ready' : queryError && 'status' in queryError && queryError.status === 404 ? 'missing' : queryError ? 'failed' : 'loading'

  const members = data?.members ?? []
  const byId = (id: string) => members.find((m) => m.id === id)
  const done = occurrence?.done ?? null
  const pending = occurrence?.pending ?? null
  const late = !done && !pending && occurrence?.date != null && occurrence.date < today
  // ребёнок, бабушка и дедушка задание с наградой только отправляют на проверку, подтверждает родитель (мама, папа)
  const isChild = !isParent(identity?.role)
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

  if (!token || !me) return null
  if (state === 'missing') return <Redirect href="/tasks" />

  const person = (id: string) => {
    const member = byId(id)
    return member ? (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Avatar name={member.name} seed={member.id} src={member.avatar} size={24} />
        <Text>{member.id === me ? `${member.name} (я)` : member.name}</Text>
      </View>
    ) : (
      '—'
    )
  }
  const repeat = task ? describeFullRepeat(task) : ''

  return (
    <Screen header={<PageHeader fallback="/tasks">{task?.title ?? ''}</PageHeader>}>
      {state === 'loading' && <Text $tone="muted">Загрузка…</Text>}
      {state === 'failed' && <Notice tone="error">Не удалось загрузить задание. Проверьте соединение.</Notice>}

      {task && state === 'ready' && (
        <>
          {done && <Notice>{`✓ Выполнено: ${byId(done.memberId)?.name ?? 'участник семьи'}, ${formatDateTime(done.at)}`}</Notice>}
          {pending && (
            <Notice tone="warning">
              {`На проверке: ${byId(pending.memberId)?.name ?? 'участник семьи'} отправил(а) ${formatDateTime(pending.at)}. ${
                isChild
                  ? `Родители проверят, и вы получите ${coinsWord(task.reward)}.`
                  : `Подтвердите, и ${byId(task.assigneeId)?.name ?? 'исполнитель'} получит ${coinsWord(task.reward)}.`
              }`}
            </Notice>
          )}
          {late && <Notice tone="error">Просрочено</Notice>}

          {task.description ? <Text>{task.description}</Text> : null}

          <Stack $gap={10}>
            <Row label="Исполнитель">{person(task.assigneeId)}</Row>
            <Row label="Автор">{person(task.authorId)}</Row>
            <Row label="Срок">{describeOccurrenceDue(task, occurrence)}</Row>
            {repeat ? <Row label="Повтор">{repeat}</Row> : null}
            {task.reward > 0 ? <Row label="Награда">{coinsWord(task.reward)}</Row> : null}
            <Row label="Создано">{formatDateTime(task.createdAt)}</Row>
          </Stack>

          {error && <Notice tone="error">{error}</Notice>}
          <Stack $gap={8}>
            {task.authorId === me && <Button onPress={() => router.push({ pathname: '/tasks/[taskId]/edit', params: { taskId: task.id } })}>Изменить</Button>}
            {occurrence && !done && !pending && (
              <Button variant="lime" disabled={busy} onPress={() => void act('complete')}>
                {needsReview ? 'Отправить на проверку' : 'Отметить выполненным'}
              </Button>
            )}
            {occurrence && pending && !isChild && (
              <>
                <Button variant="lime" disabled={busy} onPress={() => void act('confirm')}>
                  {`Подтвердить${task.reward > 0 ? `: +${coinsWord(task.reward)}` : ''}`}
                </Button>
                <Button disabled={busy} onPress={() => void act('undo')}>
                  Вернуть на доработку
                </Button>
              </>
            )}
            {occurrence && pending && isChild && (
              <Button disabled={busy} onPress={() => void act('undo')}>
                Отменить отправку
              </Button>
            )}
            {/* подтверждённое задание с наградой ребёнок снять не может */}
            {occurrence && done && !needsReview && (
              <Button disabled={busy} onPress={() => void act('undo')}>
                Снять отметку о выполнении
              </Button>
            )}
          </Stack>

          {celebrating && <Celebration title={task.title} reward={task.assigneeId === me ? task.reward : undefined} onClose={() => goBack(router, '/tasks')} />}
        </>
      )}
    </Screen>
  )
}
