import { useEffect, useState } from 'react'
import { getTrainings, type Training } from '@/api'
import { Stack } from '@/components/Stack'
import { TrainingViewList } from '@/components/TrainingViewList'
import { useIdentity } from '@/identity/context'
import { useLive } from '@/realtime/context'
import { EditLink, Header } from '../TodayLessons/styles'
import { pickTrainingDay } from '../../utils'
import type { TodayTrainingsProps } from './types'

// ближайшие тренировки самого ребёнка; если тренировок нет совсем, блок не показываем
export function TodayTrainings({ now }: TodayTrainingsProps) {
  const { identity } = useIdentity()
  const [trainings, setTrainings] = useState<Training[]>()

  const token = identity?.token
  const memberId = identity?.memberId
  const isChild = identity?.role === 'child'

  const [version, setVersion] = useState(0)
  useLive(['trainings'], (e) => {
    if (e.type === 'resync' || (e.type === 'trainings' && e.memberId === memberId)) setVersion((v) => v + 1)
  })

  useEffect(() => {
    if (!token || !memberId || !isChild) return
    let cancelled = false
    getTrainings(token, memberId)
      .then((res) => !cancelled && setTrainings(res.trainings))
      .catch(() => {})
    return () => { cancelled = true }
  }, [token, memberId, isChild, version])

  const day = trainings ? pickTrainingDay(now, trainings) : null
  if (!isChild || !day) return null

  return (
    <Stack as="section">
      <Header>
        <h2>Тренировки {day.label}</h2>
        <EditLink to="/settings/trainings">Расписание</EditLink>
      </Header>
      <TrainingViewList trainings={day.trainings} />
    </Stack>
  )
}
