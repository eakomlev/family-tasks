import { Chevron, Item, List, Number, RowLink, Subject, Time } from './styles'
import type { LessonViewListProps } from './types'
import { formatTimeRange } from './utils'

// расписание дня только для чтения; с getLink каждый урок нажимается
export function LessonViewList({ lessons, getLink }: LessonViewListProps) {
  return (
    <List>
      {lessons.map((lesson, index) => {
        const content = (
          <>
            <Number aria-hidden>{index + 1}</Number>
            <Subject>{lesson.subject}</Subject>
            <Time>{formatTimeRange(lesson)}</Time>
            {/* стрелка подсказывает, что урок нажимается */}
            {getLink && <Chevron aria-hidden>›</Chevron>}
          </>
        )
        return getLink ? (
          <Item key={lesson.key} $link>
            <RowLink to={getLink(lesson)}>{content}</RowLink>
          </Item>
        ) : (
          <Item key={lesson.key}>{content}</Item>
        )
      })}
    </List>
  )
}
