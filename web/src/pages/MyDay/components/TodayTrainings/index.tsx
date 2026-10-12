import { Stack } from '@/components/Stack'
import { TrainingViewList } from '@/components/TrainingViewList'
import { useIdentity } from '@/identity/context'
import { useGetTrainingsQuery } from '@/store/schedules'
import { EditLink, Header } from '../TodayLessons/styles'
import { pickTrainingDay } from '../../utils'
import type { TodayTrainingsProps } from './types'

// ближайшие тренировки самого ребёнка; если тренировок нет совсем, блок не показываем
export function TodayTrainings({ now }: TodayTrainingsProps) {
  const { identity } = useIdentity()
  const memberId = identity?.memberId
  const isChild = identity?.role === 'child'

  const { data } = useGetTrainingsQuery(memberId ?? '', { skip: !memberId || !isChild })
  const trainings = data?.trainings

  const day = trainings ? pickTrainingDay(now, trainings) : null
  if (!isChild || !day) return null

  return (
    <Stack as="section">
      <Header>
        <h2>Тренировки {day.label}</h2>
        <EditLink to="/profile/trainings">Расписание</EditLink>
      </Header>
      <TrainingViewList trainings={day.trainings} />
    </Stack>
  )
}
