import { Avatar } from '@/components/Avatar'
import { capitalize, lessonsForDay, pickLessonDay, pickTrainingDay, trainingSummary } from '../../../../utils'
import { ChildTasks } from './components/ChildTasks'
import { Card, LessonNumber, Lessons, Meta, Name, Room, Schedule, Subjects, Top, Training, When } from './styles'
import type { ChildCardProps } from './types'
import { dayRange, pluralLessons } from './utils'

// компактная сводка по одному ребёнку: кто, на какой день, какие предметы
export function ChildCard({ child, lessons, trainings, tasks, now }: ChildCardProps) {
  const day = lessons ? pickLessonDay(now, lessons) : undefined
  const dayLessons = lessons && day ? lessonsForDay(lessons, day.weekday) : []
  const range = dayRange(dayLessons)
  const training = trainings ? pickTrainingDay(now, trainings) : null

  // либо пояснение (загрузка, ошибка, уроков нет), либо уроки столбиком
  let message: string | undefined
  let meta: string | undefined
  if (lessons === undefined) message = 'Загрузка…'
  else if (lessons === null) message = 'Не удалось загрузить расписание.'
  else if (lessons.length === 0) message = 'Расписание не составлено.'
  else if (dayLessons.length === 0) message = `${capitalize(day?.label ?? '')} уроков нет.`
  else meta = [pluralLessons(dayLessons.length), range].filter(Boolean).join(' · ')

  return (
    <Card>
      <Schedule to={`/family/${child.id}`}>
      <Avatar name={child.name} seed={child.id} src={child.avatar} size="3rem" />
      <Top>
        <Name>{child.name}</Name>
        {day && dayLessons.length > 0 && <When>{day.label}</When>}
      </Top>
      {message && <Subjects>{message}</Subjects>}
      {!message && (
        <Lessons aria-label={`Уроки: ${child.name}`}>
          {dayLessons.map((lesson, index) => (
            <li key={lesson.key}>
              <LessonNumber aria-hidden>{index + 1}</LessonNumber>
              <span>{lesson.subject}</span>
              {lesson.room && <Room>каб. {lesson.room}</Room>}
            </li>
          ))}
        </Lessons>
      )}
      {meta && <Meta>{meta}</Meta>}
      {training && (
        <Training>
          {training.trainings.length > 1 ? 'Тренировки' : 'Тренировка'} {training.label}: {trainingSummary(training)}
        </Training>
      )}
      </Schedule>
      <ChildTasks tasks={tasks} />
    </Card>
  )
}
