import { ZoneTitle } from '@/components/ZoneTitle'
import { Notice } from '@/components/Notice'
import { Stack } from '@/components/Stack'
import { TaskItem } from '@/components/TaskItem'
import { useIdentity } from '@/identity/context'
import { useListTasksQuery } from '@/store/tasks'
import { todayIso } from '@/lib/date'
import { byTimeThenTitle, occurrenceKey, toEntries } from '@/lib/occurrences'
import { useProfile } from '@/profile/context'
import { EditLink, Header, List, Links } from '../TodayLessons/styles'
import type { TodayTasksProps } from './types'

// Мои задания на сегодня и невыполненные просроченные; задания без срока здесь не показываем (они на странице «Задания»).
export function TodayTasks({ now }: TodayTasksProps) {
  const { identity } = useIdentity()
  const { data } = useProfile()
  const today = todayIso(now)
  const me = identity?.memberId
  // из кэша сразу (в том числе сохранённого на устройстве), свежее приходит следом; обновляется по сокету через инвалидацию
  const { data: list, isError } = useListTasksQuery({ from: today, to: today })
  const failed = isError && !list

  const all = list && me ? toEntries(list, me) : []
  // у ребёнка выполненные (подтверждённые) задания на этой странице не показываем: остаётся то, что ещё надо сделать
  // (ждущие проверки родителем остаются, они ещё не засчитаны)
  const hideDone = identity?.role === 'child'
  const mine = hideDone ? all.filter(({ occurrence }) => occurrence.done === null) : all
  const allDone = hideDone && all.length > 0 && mine.length === 0
  // одним списком: сначала просроченные, потом сегодняшние по времени, в конце задания без срока; будущие дни здесь не показываем
  const rank = (entry: (typeof mine)[number]) => (entry.occurrence.date === null ? 2 : entry.occurrence.date < today ? 0 : 1)
  const list_ = mine
    .filter(({ occurrence }) => occurrence.date === null || occurrence.date <= today)
    .sort((a, b) => rank(a) - rank(b) || byTimeThenTitle(a, b))
  const empty = list_.length === 0

  // заданий нет вовсе: блок не показываем (ни заголовка, ни подсказки)
  if (list && empty && !allDone) return null

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
        <ZoneTitle tone="mine" icon="tasks" right={<Links><EditLink to="/tasks/new">+ Добавить</EditLink></Links>}>
          Задания на сегодня
        </ZoneTitle>
      </Header>
      {failed && <Notice $tone="error">Не удалось загрузить задания. Проверьте соединение.</Notice>}
      {!list && !failed && <p>Загрузка…</p>}
      {list && empty && (
        <Notice $tone="muted">Все задания на сегодня выполнены.</Notice>
      )}
      {list_.length > 0 && <List>{list_.map(renderItem)}</List>}
    </Stack>
  )
}
