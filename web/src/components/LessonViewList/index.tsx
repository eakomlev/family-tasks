import { Item, List, Number, Subject, Time } from './styles'
import type { LessonViewListProps } from './types'
import { formatTimeRange } from './utils'

// расписание дня только для чтения
export function LessonViewList({ lessons }: LessonViewListProps) {
  return (
    <List>
      {lessons.map((lesson, index) => (
        <Item key={lesson.key}>
          <Number aria-hidden>{index + 1}</Number>
          <Subject>{lesson.subject}</Subject>
          <Time>{formatTimeRange(lesson)}</Time>
        </Item>
      ))}
    </List>
  )
}
