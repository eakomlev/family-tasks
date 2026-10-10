import { Avatar } from '@/components/Avatar'
import { capitalize, lessonsForDay, pickLessonDay } from '../../../../utils'
import { Card, Meta, Name, Subjects, Top, When } from './styles'
import type { ChildCardProps } from './types'
import { dayRange, pluralLessons } from './utils'

// компактная сводка по одному ребёнку: кто, на какой день, какие предметы
export function ChildCard({ child, lessons, now }: ChildCardProps) {
  const day = lessons ? pickLessonDay(now, lessons) : undefined
  const dayLessons = lessons && day ? lessonsForDay(lessons, day.weekday) : []
  const range = dayRange(dayLessons)

  let subjects: string | undefined
  let meta: string | undefined
  if (lessons === undefined) subjects = 'Загрузка…'
  else if (lessons === null) subjects = 'Не удалось загрузить расписание.'
  else if (lessons.length === 0) subjects = 'Расписание не составлено.'
  else if (dayLessons.length === 0) subjects = `${capitalize(day?.label ?? '')} уроков нет.`
  else {
    subjects = dayLessons.map((l) => l.subject).join(' · ')
    meta = [pluralLessons(dayLessons.length), range].filter(Boolean).join(' · ')
  }

  return (
    <Card to={`/family/${child.id}/schedule`}>
      <Avatar name={child.name} seed={child.id} src={child.avatar} size="2rem" />
      <Top>
        <Name>{child.name}</Name>
        {day && dayLessons.length > 0 && <When>{day.label}</When>}
      </Top>
      <Subjects>{subjects}</Subjects>
      {meta && <Meta>{meta}</Meta>}
    </Card>
  )
}
