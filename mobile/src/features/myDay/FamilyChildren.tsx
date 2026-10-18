import { View } from 'react-native'
import type { Lesson, Member, Training } from '@/api'
import { Avatar } from '@/components/Avatar'
import { Card } from '@/components/Card'
import { Stack } from '@/components/Stack'
import { Heading, Text } from '@/components/Text'
import { useIdentity } from '@/identity/context'
import { todayIso } from '@/lib/date'
import { byTimeThenTitle, toEntries, type TaskEntry } from '@/lib/occurrences'
import { useProfile } from '@/profile/context'
import { useGetScheduleQuery, useGetTrainingsQuery } from '@/store/schedules'
import { useListTasksQuery } from '@/store/tasks'
import { capitalize, dayRange, lessonsForDay, pickLessonDay, pickTrainingDay, pluralLessons, trainingSummary } from './schedule'

interface ChildTaskList {
  // вхождения на сегодня, в том числе выполненные
  today: TaskEntry[]
  // задания без срока
  undated: TaskEntry[]
}

function ChildTasks({ tasks }: { tasks: ChildTaskList | undefined }) {
  if (!tasks) return null
  const all = [...tasks.today, ...tasks.undated]
  if (all.length === 0) return null
  const done = all.filter((e) => e.occurrence.done !== null).length

  return (
    <View style={{ gap: 6, marginTop: 10 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text $weight="extraBold" $size={13} $tone="muted">
          Задания на сегодня
        </Text>
        <Text $size={13} $tone="muted">{`выполнено ${done} из ${all.length}`}</Text>
      </View>
      {all.map(({ task, occurrence }) => {
        const isDone = occurrence.done !== null
        const mark = isDone ? '✅' : occurrence.pending !== null ? '⏳' : '⚪'
        return (
          <View key={`${task.id}|${occurrence.date ?? 'none'}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text $size={14}>{mark}</Text>
            <Text style={{ flex: 1, textDecorationLine: isDone ? 'line-through' : 'none' }} $size={15}>
              {task.title}
            </Text>
            {task.time ? (
              <Text $size={13} $tone="muted">
                {task.time}
              </Text>
            ) : null}
          </View>
        )
      })}
    </View>
  )
}

// Карточка одного ребёнка: уроки на ближайший день, тренировка и задания. Расписания грузятся независимо, сбой одного не прячет другое
// (undefined — загрузка, null — не удалось).
function ChildCard({
  child,
  lessons,
  trainings,
  tasks,
  now,
}: {
  child: Member
  lessons: Lesson[] | null | undefined
  trainings: Training[] | null | undefined
  tasks: ChildTaskList | undefined
  now: Date
}) {
  const day = lessons ? pickLessonDay(now, lessons) : undefined
  const dayLessons = lessons && day ? lessonsForDay(lessons, day.weekday) : []
  const range = dayRange(dayLessons)
  const training = trainings ? pickTrainingDay(now, trainings) : null

  let message: string | undefined
  let meta: string | undefined
  if (lessons === undefined) message = 'Загрузка…'
  else if (lessons === null) message = 'Не удалось загрузить расписание.'
  else if (lessons.length === 0) message = 'Расписание не составлено.'
  else if (dayLessons.length === 0) message = `${capitalize(day?.label ?? '')} уроков нет.`
  else meta = [pluralLessons(dayLessons.length), range].filter(Boolean).join(' · ')

  return (
    <Card>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Avatar name={child.name} seed={child.id} src={child.avatar} size={48} />
        <Text $weight="black" $size={19} style={{ flex: 1 }}>
          {child.name}
        </Text>
        {day && dayLessons.length > 0 && (
          <Text $size={13} $weight="bold" $tone="accent">
            {day.label}
          </Text>
        )}
      </View>
      <View style={{ marginTop: 10, gap: 4 }}>
        {message && (
          <Text $tone="muted" $size={14}>
            {message}
          </Text>
        )}
        {dayLessons.map((lesson, index) => (
          <View key={lesson.key} style={{ flexDirection: 'row', gap: 8 }}>
            <Text $size={14} $tone="muted" style={{ width: 18 }}>{`${index + 1}`}</Text>
            <Text $size={15} style={{ flex: 1 }}>
              {lesson.subject}
            </Text>
            {lesson.room ? (
              <Text $size={13} $tone="muted">
                {`каб. ${lesson.room}`}
              </Text>
            ) : null}
          </View>
        ))}
        {meta && (
          <Text $size={13} $tone="muted">
            {meta}
          </Text>
        )}
        {training && (
          <Text $size={13} $tone="muted">
            {`${training.trainings.length > 1 ? 'Тренировки' : 'Тренировка'} ${training.label}: ${trainingSummary(training)}`}
          </Text>
        )}
      </View>
      <ChildTasks tasks={tasks} />
    </Card>
  )
}

function ChildWithSchedules({ child, tasks, now }: { child: Member; tasks: ChildTaskList | undefined; now: Date }) {
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

// Сводка уроков, тренировок и заданий всех детей для взрослых; у детей вместо неё свои блоки
export function FamilyChildren({ now }: { now: Date }) {
  const { identity } = useIdentity()
  const { data } = useProfile()
  const today = todayIso(now)

  const isAdult = !!identity && identity.role !== 'child'
  const children = data?.members.filter((m) => m.role === 'child') ?? []

  // задания всей семьи на сегодня одним запросом (тот же, что у «Заданий на сегодня»: в кэше он общий)
  const { data: tasks } = useListTasksQuery({ from: today, to: today }, { skip: !isAdult })

  if (!isAdult || children.length === 0) return null

  // сегодняшние вхождения, в том числе выполненные, и отдельно задания без срока (просроченные сюда не входят)
  const childTasks = (childId: string): ChildTaskList | undefined => {
    if (!tasks) return undefined
    const entries = toEntries(tasks, childId)
    return {
      today: entries.filter(({ occurrence }) => occurrence.date === today).sort(byTimeThenTitle),
      undated: entries.filter(({ occurrence }) => occurrence.date === null).sort(byTimeThenTitle),
    }
  }

  return (
    <Stack $gap={10}>
      <Heading>Дети: уроки, тренировки и задания</Heading>
      {children.map((child) => (
        <ChildWithSchedules key={child.id} child={child} tasks={childTasks(child.id)} now={now} />
      ))}
    </Stack>
  )
}
