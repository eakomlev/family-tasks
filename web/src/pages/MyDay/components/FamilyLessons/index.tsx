import { useEffect, useState } from 'react'
import { getSchedule, getTrainings, listTasks, type TaskList } from '@/api'
import { Stack } from '@/components/Stack'
import { useIdentity } from '@/identity/context'
import { todayIso } from '@/lib/date'
import { byTimeThenTitle, toEntries } from '@/lib/occurrences'
import { useProfile } from '@/profile/context'
import { useLive } from '@/realtime/context'
import { ChildCard } from './components/ChildCard'
import { List } from './styles'
import type { FamilyLessonsProps, SchedulesByChild } from './types'

// сводка уроков всех детей для родителей; у детей вместо неё свой блок TodayLessons
export function FamilyLessons({ now }: FamilyLessonsProps) {
  const { identity } = useIdentity()
  const { data } = useProfile()
  const [byChild, setByChild] = useState<SchedulesByChild>({})
  const [version, setVersion] = useState(0)
  const [tasks, setTasks] = useState<TaskList>()
  const [tasksVersion, setTasksVersion] = useState(0)
  useLive(['schedule', 'trainings'], () => setVersion((v) => v + 1))
  useLive(['tasks'], () => setTasksVersion((v) => v + 1))
  const today = todayIso(now)

  const token = identity?.token
  const isParent = !!identity && identity.role !== 'child'
  const children = data?.members.filter((m) => m.role === 'child') ?? []
  // строка вместо массива, чтобы эффект не перезапускался при каждой перерисовке
  const childIds = children.map((c) => c.id).join(',')

  useEffect(() => {
    if (!token || !isParent || !childIds) return
    let cancelled = false
    Promise.all(
      childIds.split(',').map(async (id) => {
        // уроки и тренировки грузятся независимо: сбой одного не прячет другое
        const [lessons, trainings] = await Promise.all([
          getSchedule(token, id).then((res) => res.lessons, () => null),
          getTrainings(token, id).then((res) => res.trainings, () => null),
        ])
        return [id, { lessons, trainings }] as const
      }),
    ).then((entries) => !cancelled && setByChild(Object.fromEntries(entries)))
    return () => { cancelled = true }
  }, [token, isParent, childIds, version])

  // задания всей семьи на сегодня одним запросом; ошибка не мешает остальной сводке (блок заданий просто не появится)
  useEffect(() => {
    if (!token || !isParent) return
    let cancelled = false
    listTasks(token, today, today)
      .then((res) => !cancelled && setTasks(res))
      .catch(() => {})
    return () => { cancelled = true }
  }, [token, isParent, today, tasksVersion])

  if (!isParent || children.length === 0) return null

  // сегодняшние вхождения ребёнка, в том числе выполненные (просроченные и без срока сюда не входят)
  const todayTasks = (childId: string) =>
    tasks
      ? toEntries(tasks, childId)
          .filter(({ occurrence }) => occurrence.date === today)
          .sort(byTimeThenTitle)
      : undefined

  return (
    <Stack as="section">
      <h2>Дети: уроки, тренировки и задания</h2>
      <List>
        {children.map((child) => (
          <ChildCard
            key={child.id}
            child={child}
            lessons={byChild[child.id]?.lessons}
            trainings={byChild[child.id]?.trainings}
            tasks={todayTasks(child.id)}
            now={now}
          />
        ))}
      </List>
    </Stack>
  )
}
