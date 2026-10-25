import { ZoneTitle } from '@/components/ZoneTitle'
import type { Member } from '@/api'
import { Stack } from '@/components/Stack'
import { useIdentity } from '@/identity/context'
import { todayIso } from '@/lib/date'
import { byTimeThenTitle, toEntries } from '@/lib/occurrences'
import { useProfile } from '@/profile/context'
import { useGetScheduleQuery, useGetTrainingsQuery } from '@/store/schedules'
import { useListTasksQuery } from '@/store/tasks'
import { ChildCard } from './components/ChildCard'
import type { ChildCardProps } from './components/ChildCard/types'
import { List } from './styles'
import type { FamilyLessonsProps } from './types'

// Карточка ребёнка со своими расписаниями из кэша: уроки и тренировки загружаются независимо, сбой одного не прячет другое
// (undefined — загрузка, null — не удалось)
function ChildWithSchedules({ child, tasks, now }: { child: Member; tasks: ChildCardProps['tasks']; now: Date }) {
  const schedule = useGetScheduleQuery(child.id)
  const trainings = useGetTrainingsQuery(child.id)
  return (
    <ChildCard
      child={child}
      lessons={schedule.data?.lessons ?? (schedule.isError ? null : undefined)}
      trainings={trainings.data?.trainings ?? (trainings.isError ? null : undefined)}
      tasks={tasks}
      now={now}
    />
  )
}

// сводка уроков всех детей для родителей; у детей вместо неё свой блок TodayLessons
export function FamilyLessons({ now }: FamilyLessonsProps) {
  const { identity } = useIdentity()
  const { data } = useProfile()
  const today = todayIso(now)

  const isParent = !!identity && identity.role !== 'child'
  const children = data?.members.filter((m) => m.role === 'child') ?? []

  // задания всей семьи на сегодня одним запросом (тот же, что у «Заданий на сегодня»: в кэше он общий);
  // ошибка не мешает остальной сводке (блок заданий просто не появится)
  const { data: tasks } = useListTasksQuery({ from: today, to: today }, { skip: !isParent })

  if (!isParent || children.length === 0) return null

  // Задания ребёнка: сегодняшние вхождения, в том числе выполненные, и отдельно задания без срока (просроченные сюда не входят)
  const childTasks = (childId: string) => {
    if (!tasks) return undefined
    const entries = toEntries(tasks, childId)
    return {
      today: entries.filter(({ occurrence }) => occurrence.date === today).sort(byTimeThenTitle),
      undated: entries.filter(({ occurrence }) => occurrence.date === null).sort(byTimeThenTitle),
    }
  }

  return (
    <Stack as="section">
      <ZoneTitle tone="kids" icon="kids" count={children.length} countLabel={`Детей: ${children.length}`}>
        Дети: уроки, тренировки и задания
      </ZoneTitle>
      <List>
        {children.map((child) => (
          <ChildWithSchedules key={child.id} child={child} tasks={childTasks(child.id)} now={now} />
        ))}
      </List>
    </Stack>
  )
}
