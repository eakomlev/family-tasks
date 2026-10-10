import { formatTimeRange } from '@/components/LessonViewList/utils'
import { Item, List, Main, Place, Time, Title } from './styles'
import type { TrainingViewListProps } from './types'

// тренировки дня только для чтения
export function TrainingViewList({ trainings }: TrainingViewListProps) {
  return (
    <List>
      {trainings.map((training) => (
        <Item key={training.key}>
          <Main>
            <Title>{training.title}</Title>
            {training.place && <Place>{training.place}</Place>}
          </Main>
          <Time>{formatTimeRange(training)}</Time>
        </Item>
      ))}
    </List>
  )
}
