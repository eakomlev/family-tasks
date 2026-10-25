import { ZoneTitle } from '@/components/ZoneTitle'
import { LessonViewList } from '@/components/LessonViewList'
import { Notice } from '@/components/Notice'
import { Stack } from '@/components/Stack'
import { useIdentity } from '@/identity/context'
import { useGetScheduleQuery } from '@/store/schedules'
import { EditLink, Header } from './styles'
import type { TodayLessonsProps } from './types'
import { capitalize, lessonsForDay, pickLessonDay } from '../../utils'

// уроки самого ребёнка; у родителей расписания нет, для них есть FamilyLessons
export function TodayLessons({ now }: TodayLessonsProps) {
  const { identity } = useIdentity()
  const memberId = identity?.memberId
  const isChild = identity?.role === 'child'

  // расписание из кэша сразу (в том числе сохранённого на устройстве), свежее приходит следом и после правок
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
    <Stack as="section">
      <Header>
        <ZoneTitle tone="mine" icon="lessons" right={<EditLink to="/profile/schedule">Расписание</EditLink>}>
          {lessons ? `Уроки ${day.label}` : 'Уроки'}
        </ZoneTitle>
      </Header>
      {failed && <Notice $tone="error">Не удалось загрузить расписание. Проверьте соединение.</Notice>}
      {!lessons && !failed && <p>Загрузка…</p>}
      {empty && <Notice $tone="muted">{empty}</Notice>}
      {dayLessons.length > 0 && <LessonViewList lessons={dayLessons} getLink={(lesson) => `/lesson-report?subject=${encodeURIComponent(lesson.subject)}`} />}
    </Stack>
  )
}
