import { useEffect, useState } from 'react'
import { getSchedule, type Lesson } from '@/api'
import { LessonViewList } from '@/components/LessonViewList'
import { Notice } from '@/components/Notice'
import { Stack } from '@/components/Stack'
import { useIdentity } from '@/identity/context'
import { EditLink, Header } from './styles'
import type { TodayLessonsProps } from './types'
import { capitalize, lessonsForDay, pickLessonDay } from './utils'

// уроки ребёнка на сегодня; у родителей расписания нет, поэтому им блок не показываем
export function TodayLessons({ now }: TodayLessonsProps) {
  const { identity } = useIdentity()
  const [lessons, setLessons] = useState<Lesson[]>()
  const [failed, setFailed] = useState(false)

  const token = identity?.token
  const memberId = identity?.memberId
  const isChild = identity?.role === 'child'

  useEffect(() => {
    if (!token || !memberId || !isChild) return
    let cancelled = false
    getSchedule(token, memberId)
      .then((res) => !cancelled && setLessons(res.lessons))
      .catch(() => !cancelled && setFailed(true))
    return () => { cancelled = true }
  }, [token, memberId, isChild])

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
        <h2>{lessons ? `Уроки ${day.label}` : 'Уроки'}</h2>
        <EditLink to="/settings/schedule">Расписание</EditLink>
      </Header>
      {failed && <Notice $tone="error">Не удалось загрузить расписание. Проверьте соединение.</Notice>}
      {!lessons && !failed && <p>Загрузка…</p>}
      {empty && <Notice $tone="muted">{empty}</Notice>}
      {dayLessons.length > 0 && <LessonViewList lessons={dayLessons} />}
    </Stack>
  )
}
