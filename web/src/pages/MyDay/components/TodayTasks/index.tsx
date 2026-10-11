import { useEffect, useState } from 'react'
import { listTasks, type TaskList } from '@/api'
import { Notice } from '@/components/Notice'
import { Stack } from '@/components/Stack'
import { TaskItem } from '@/components/TaskItem'
import { useIdentity } from '@/identity/context'
import { useLive } from '@/realtime/context'
import { todayIso } from '@/lib/date'
import { byTimeThenTitle, occurrenceKey, toEntries } from '@/lib/occurrences'
import { useProfile } from '@/profile/context'
import { EditLink, Header, List, Links, SubTitle } from '../TodayLessons/styles'
import type { TodayTasksProps } from './types'

// Мои задания на сегодня и невыполненные просроченные; задания без срока здесь не показываем (они на странице «Задания»).
export function TodayTasks({ now }: TodayTasksProps) {
  const { identity } = useIdentity()
  const { data } = useProfile()
  const today = todayIso(now)
  const [list, setList] = useState<TaskList>()
  const [failed, setFailed] = useState(false)
  const [version, setVersion] = useState(0)
  useLive(['tasks'], () => setVersion((v) => v + 1))

  const token = identity?.token
  const me = identity?.memberId

  useEffect(() => {
    if (!token) return
    let cancelled = false
    listTasks(token, today, today)
      .then((res) => !cancelled && setList(res))
      .catch(() => !cancelled && setFailed(true))
    return () => { cancelled = true }
  }, [token, today, version])

  const all = list && me ? toEntries(list, me) : []
  // у ребёнка выполненные (подтверждённые) задания на этой странице не показываем: остаётся то, что ещё надо сделать
  // (ждущие проверки родителем остаются, они ещё не засчитаны)
  const hideDone = identity?.role === 'child'
  const mine = hideDone ? all.filter(({ occurrence }) => occurrence.done === null) : all
  const allDone = hideDone && all.length > 0 && mine.length === 0
  // сначала просроченные, потом сегодняшние по времени; будущие дни здесь не показываем
  const dated = mine
    .filter(({ occurrence }) => occurrence.date !== null && occurrence.date <= today)
    .sort((a, b) => {
      const lateA = a.occurrence.date! < today
      const lateB = b.occurrence.date! < today
      return lateA === lateB ? byTimeThenTitle(a, b) : lateA ? -1 : 1
    })
  // задания без срока: невыполненные, отдельной группой в конце
  const undated = mine.filter(({ occurrence }) => occurrence.date === null).sort(byTimeThenTitle)
  const empty = dated.length === 0 && undated.length === 0

  const renderItem = (entry: (typeof mine)[number]) => (
    <TaskItem
      key={occurrenceKey(entry.task.id, entry.occurrence.date)}
      task={entry.task}
      occurrence={entry.occurrence}
      assignee={data?.members.find((m) => m.id === entry.task.assigneeId)}
      author={data?.members.find((m) => m.id === entry.task.authorId)}
      today={today}
    />
  )

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
      {!list && !failed && <p>Загрузка…</p>}
      {list && empty && (
        <Notice $tone="muted">{allDone ? 'Все задания на сегодня выполнены.' : 'Заданий на сегодня и без срока нет.'}</Notice>
      )}
      {dated.length > 0 && <List>{dated.map(renderItem)}</List>}
      {undated.length > 0 && (
        <>
          <SubTitle>Без срока</SubTitle>
          <List>{undated.map(renderItem)}</List>
        </>
      )}
    </Stack>
  )
}
