import { Pressable, View } from 'react-native'
import { ZoneTitle } from '@/components/ZoneTitle'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from 'styled-components/native'
import type { Lesson, Member, Training } from '@/api'
import { Avatar } from '@/components/Avatar'
import { Card } from '@/components/Card'
import { Stack } from '@/components/Stack'
import { Text } from '@/components/Text'
import { useIdentity } from '@/identity/context'
import { todayIso } from '@/lib/date'
import { byTimeThenTitle, toEntries, type TaskEntry } from '@/lib/occurrences'
import { useProfile } from '@/profile/context'
import { useGetScheduleQuery, useGetTrainingsQuery } from '@/store/schedules'
import { useListTasksQuery } from '@/store/tasks'
import { capitalize, dayRange, lessonsForDay, pickLessonDay, pickTrainingDay, trainingSummary } from './schedule'

type IconName = keyof typeof Ionicons.glyphMap

interface ChildTaskList {
  // вхождения на сегодня, в том числе выполненные
  today: TaskEntry[]
  // задания без срока
  undated: TaskEntry[]
}

// Заголовок раздела внутри карточки: значок и подпись, справа необязательная сводка
function SectionLabel({ icon, title, hint }: { icon: IconName; title: string; hint?: string }) {
  const { colors } = useTheme()
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <Ionicons name={icon} size={16} color={colors.accent} />
      <Text $weight="extraBold" $size={13} $tone="accent" style={{ textTransform: 'uppercase', letterSpacing: 0.4 }}>
        {title}
      </Text>
      {hint ? (
        <Text $size={13} $tone="muted" style={{ flex: 1, textAlign: 'right' }}>
          {hint}
        </Text>
      ) : null}
    </View>
  )
}

function Divider() {
  const { colors } = useTheme()
  return <View style={{ height: 1, backgroundColor: colors.border, opacity: 0.6, marginVertical: 12 }} />
}

function ChildTasks({ tasks }: { tasks: ChildTaskList | undefined }) {
  if (!tasks) return null
  const all = [...tasks.today, ...tasks.undated]
  if (all.length === 0) return null
  const done = all.filter((e) => e.occurrence.done !== null).length

  return (
    <>
      <Divider />
      <View style={{ gap: 8 }}>
        <SectionLabel icon="checkbox-outline" title="Задания" hint={`выполнено ${done} из ${all.length}`} />
        {all.filter(({ occurrence }) => occurrence.done === null).map(({ task, occurrence }) => {
          const isDone = occurrence.done !== null
          const mark = isDone ? '✅' : occurrence.pending !== null ? '⏳' : '⚪'
          return (
            <View key={`${task.id}|${occurrence.date ?? 'none'}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 22 }}>
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
    </>
  )
}

// Карточка одного ребёнка: шапка (нажатие открывает его страницу), затем разделы «Уроки», «Тренировка» и «Задания».
// Расписания грузятся независимо, сбой одного не прячет другое (undefined — загрузка, null — не удалось).
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
  const router = useRouter()
  const { colors } = useTheme()
  const day = lessons ? pickLessonDay(now, lessons) : undefined
  const dayLessons = lessons && day ? lessonsForDay(lessons, day.weekday) : []
  const range = dayRange(dayLessons)
  const training = trainings ? pickTrainingDay(now, trainings) : null

  let message: string | undefined
  if (lessons === undefined) message = 'Загрузка…'
  else if (lessons === null) message = 'Не удалось загрузить расписание.'
  else if (lessons.length === 0) message = 'Расписание не составлено.'
  else if (dayLessons.length === 0) message = `${capitalize(day?.label ?? '')} уроков нет.`

  return (
    <Pressable
      onPress={() => router.push({ pathname: '/family/[memberId]', params: { memberId: child.id } })}
      accessibilityRole="button"
      accessibilityLabel={`${child.name}: открыть страницу`}
    >
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Avatar name={child.name} seed={child.id} src={child.avatar} size={48} />
          <Text $weight="black" $size={20} style={{ flex: 1 }}>
            {child.name}
          </Text>
          <Ionicons name="chevron-forward" size={20} color={colors.muted} />
        </View>

        {(message || dayLessons.length > 0) && (
          <>
            <Divider />
            <View style={{ gap: 8 }}>
              <SectionLabel icon="school-outline" title={day && dayLessons.length > 0 ? `Уроки · ${day.label}` : 'Уроки'} hint={range} />
              {message && (
                <Text $tone="muted" $size={14} style={{ paddingLeft: 22 }}>
                  {message}
                </Text>
              )}
              {dayLessons.map((lesson, index) => (
                <View key={lesson.key} style={{ flexDirection: 'row', alignItems: 'baseline', gap: 10, paddingLeft: 22 }}>
                  <Text $size={14} $weight="bold" $tone="muted" style={{ width: 16 }}>{`${index + 1}`}</Text>
                  <Text $size={16} style={{ flexShrink: 1 }}>
                    {lesson.subject}
                  </Text>
                  {lesson.room ? (
                    <Text $size={13} $weight="bold" $tone="accent">
                      {`каб. ${lesson.room}`}
                    </Text>
                  ) : null}
                </View>
              ))}
            </View>
          </>
        )}

        {training && (
          <>
            <Divider />
            <View style={{ gap: 6 }}>
              <SectionLabel icon="fitness-outline" title={`${training.trainings.length > 1 ? 'Тренировки' : 'Тренировка'} · ${training.label}`} />
              <Text $size={16} style={{ paddingLeft: 22 }}>
                {trainingSummary(training)}
              </Text>
            </View>
          </>
        )}

        <ChildTasks tasks={tasks} />
      </Card>
    </Pressable>
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
      <ZoneTitle tone="kids" icon="kids" count={children.length}>
        Дети
      </ZoneTitle>
      {children.map((child) => (
        <ChildWithSchedules key={child.id} child={child} tasks={childTasks(child.id)} now={now} />
      ))}
    </Stack>
  )
}
