import { useRouter } from 'expo-router'
import { ZoneTitle } from '@/components/ZoneTitle'
import { Notice } from '@/components/Notice'
import { Stack } from '@/components/Stack'
import { Text } from '@/components/Text'
import { useIdentity } from '@/identity/context'
import { useGetScheduleQuery, useGetTrainingsQuery } from '@/store/schedules'
import { LessonList, TrainingList } from './ScheduleLists'
import { capitalize, lessonsForDay, pickLessonDay, pickTrainingDay } from './schedule'

// Уроки самого ребёнка на сегодня или завтра; у родителей блока нет (у них сводка по детям)
export function TodayLessons({ now }: { now: Date }) {
  const router = useRouter()
  const { identity } = useIdentity()
  const memberId = identity?.memberId
  const isChild = identity?.role === 'child'

  // расписание из кэша сразу, свежее приходит следом и после правок
  const query = useGetScheduleQuery(memberId ?? '', { skip: !memberId || !isChild })
  const lessons = query.data?.lessons
  const failed = query.isError && !lessons
  if (!isChild) return null

  const day = pickLessonDay(now, lessons ?? [])
  const dayLessons = lessonsForDay(lessons ?? [], day.weekday)

  let empty: string | undefined
  if (lessons && dayLessons.length === 0) {
    empty = lessons.length === 0 ? 'Расписание ещё не составлено.' : `${capitalize(day.label)} уроков нет.`
  }

  return (
    <Stack $gap={10}>
      <ZoneTitle tone="mine" icon="lessons">
        {lessons ? `Уроки ${day.label}` : 'Уроки'}
      </ZoneTitle>
      {failed && <Notice tone="error">Не удалось загрузить расписание. Проверьте соединение.</Notice>}
      {!lessons && !failed && <Text $tone="muted">Загрузка…</Text>}
      {empty && <Notice>{empty}</Notice>}
      {/* нажатие на урок открывает «Что ты хочешь сообщить!» */}
      {dayLessons.length > 0 && <LessonList lessons={dayLessons} onPress={(lesson) => router.push({ pathname: '/lesson-report', params: { subject: lesson.subject } })} />}
    </Stack>
  )
}

// Ближайшие тренировки ребёнка; если тренировок нет совсем, блока нет
export function TodayTrainings({ now }: { now: Date }) {
  const { identity } = useIdentity()
  const memberId = identity?.memberId
  const isChild = identity?.role === 'child'

  const { data } = useGetTrainingsQuery(memberId ?? '', { skip: !memberId || !isChild })
  const day = data?.trainings ? pickTrainingDay(now, data.trainings) : null
  if (!isChild || !day) return null

  return (
    <Stack $gap={10}>
      <ZoneTitle tone="mine" icon="training">
        {`Тренировки ${day.label}`}
      </ZoneTitle>
      <TrainingList trainings={day.trainings} />
    </Stack>
  )
}
