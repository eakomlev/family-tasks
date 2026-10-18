import { Notice } from '@/components/Notice'
import { Stack } from '@/components/Stack'
import { Heading, Text } from '@/components/Text'
import { TaskItem } from '@/features/tasks/TaskItem'
import { useIdentity } from '@/identity/context'
import { todayIso } from '@/lib/date'
import { byTimeThenTitle, occurrenceKey, toEntries, type TaskEntry } from '@/lib/occurrences'
import { useProfile } from '@/profile/context'
import { useListTasksQuery } from '@/store/tasks'

// Мои задания на сегодня, просроченные и без срока. Нажатие на карточку открывает страницу задания.
export function TodayTasks({ now }: { now: Date }) {
  const { identity } = useIdentity()
  const { data } = useProfile()
  const today = todayIso(now)
  const me = identity?.memberId
  const { data: list, isError } = useListTasksQuery({ from: today, to: today })
  const failed = isError && !list

  const all = list && me ? toEntries(list, me) : []
  // у ребёнка выполненные (подтверждённые) задания на этой странице не показываем: остаётся то, что ещё надо сделать
  const hideDone = identity?.role === 'child'
  const mine = hideDone ? all.filter(({ occurrence }) => occurrence.done === null) : all
  const allDone = hideDone && all.length > 0 && mine.length === 0
  // сначала просроченные, потом сегодняшние по времени, в конце без срока; будущие дни здесь не показываем
  const rank = (entry: TaskEntry) => (entry.occurrence.date === null ? 2 : entry.occurrence.date < today ? 0 : 1)
  const items = mine
    .filter(({ occurrence }) => occurrence.date === null || occurrence.date <= today)
    .sort((a, b) => rank(a) - rank(b) || byTimeThenTitle(a, b))

  // заданий нет: блок не показываем (ни заголовка, ни пояснения)
  if (list && items.length === 0 && !allDone) return null

  return (
    <Stack $gap={10}>
      <Heading>Задания на сегодня</Heading>
      {failed && <Notice tone="error">Не удалось загрузить задания. Проверьте соединение.</Notice>}
      {!list && !failed && <Text $tone="muted">Загрузка…</Text>}
      {list && items.length === 0 && <Notice>Все задания на сегодня выполнены.</Notice>}
      {items.map((entry) => (
        <TaskItem
          key={occurrenceKey(entry.task.id, entry.occurrence.date)}
          task={entry.task}
          occurrence={entry.occurrence}
          assignee={data?.members.find((m) => m.id === entry.task.assigneeId)}
          author={data?.members.find((m) => m.id === entry.task.authorId)}
          today={today}
        />
      ))}
    </Stack>
  )
}
