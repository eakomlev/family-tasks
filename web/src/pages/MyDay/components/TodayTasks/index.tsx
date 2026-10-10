import { useEffect, useState } from 'react'
import { listTasks, type TaskList } from '@/api'
import { Notice } from '@/components/Notice'
import { Stack } from '@/components/Stack'
import { TaskItem } from '@/components/TaskItem'
import { useIdentity } from '@/identity/context'
import { todayIso } from '@/lib/date'
import { byTimeThenTitle, occurrenceKey, toEntries } from '@/lib/occurrences'
import { useToggleOccurrence } from '@/lib/useToggleOccurrence'
import { EditLink, Header, List, Links } from '../TodayLessons/styles'
import type { TodayTasksProps } from './types'

// Мои задания на сегодня и невыполненные просроченные; задания без срока здесь не показываем (они на странице «Задания»).
export function TodayTasks({ now }: TodayTasksProps) {
  const { identity } = useIdentity()
  const today = todayIso(now)
  const [list, setList] = useState<TaskList>()
  const [failed, setFailed] = useState(false)

  const token = identity?.token
  const me = identity?.memberId
  const { busy, error, toggle } = useToggleOccurrence(token, me, list, setList)

  useEffect(() => {
    if (!token) return
    let cancelled = false
    listTasks(token, today, today)
      .then((res) => !cancelled && setList(res))
      .catch(() => !cancelled && setFailed(true))
    return () => { cancelled = true }
  }, [token, today])

  const entries = list && me
    ? toEntries(list, me).filter(({ occurrence }) => occurrence.date !== null && occurrence.date <= today)
    : []
  // сначала просроченные, потом сегодняшние по времени
  const sorted = [...entries].sort((a, b) => {
    const lateA = a.occurrence.date! < today
    const lateB = b.occurrence.date! < today
    return lateA === lateB ? byTimeThenTitle(a, b) : lateA ? -1 : 1
  })

  return (
    <Stack as="section">
      <Header>
        <h2>Задания на сегодня</h2>
        <Links>
          <EditLink to="/tasks/new">+ Добавить</EditLink>
          <EditLink to="/tasks">Все</EditLink>
        </Links>
      </Header>
      {failed && <Notice $tone="error">Не удалось загрузить задания. Проверьте соединение.</Notice>}
      {error && <Notice $tone="error">{error}</Notice>}
      {!list && !failed && <p>Загрузка…</p>}
      {list && sorted.length === 0 && <Notice $tone="muted">На сегодня заданий нет.</Notice>}
      {sorted.length > 0 && (
        <List>
          {sorted.map((entry) => (
            <TaskItem
              key={occurrenceKey(entry.task.id, entry.occurrence.date)}
              task={entry.task}
              occurrence={entry.occurrence}
              today={today}
              disabled={busy === occurrenceKey(entry.task.id, entry.occurrence.date)}
              onToggle={() => toggle(entry)}
            />
          ))}
        </List>
      )}
    </Stack>
  )
}
