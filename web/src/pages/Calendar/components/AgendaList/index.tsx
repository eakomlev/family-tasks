import { Link } from 'react-router-dom'
import { timeLabel, type CalendarItem } from '@/lib/calendar'
import type { CalendarKind } from '@/lib/calendarSettings'
import { Emoji, Empty, Info, List, Row, When } from '../../styles'

const KIND_EMOJI: Record<CalendarKind, string> = { event: '📅', task: '✅', birthday: '🎂', training: '🏃', holiday: '🎉' }

function RowContent({ item }: { item: CalendarItem }) {
  return (
    <>
      <Emoji aria-hidden>{KIND_EMOJI[item.kind]}</Emoji>
      <Info $done={item.done}>
        <strong>{item.title}</strong>
        {item.subtitle && <small>{item.subtitle}</small>}
      </Info>
      {/* праздникам и дням рождения «весь день» не пишем: это и так понятно */}
      {(item.start || item.end || item.kind === 'event' || item.kind === 'task') && <When>{timeLabel(item)}</When>}
    </>
  )
}

// Записи одного дня списком: цветная полоска слева показывает вид, нажатие открывает запись
export function AgendaList({ items, emptyText = 'Записей нет' }: { items: CalendarItem[]; emptyText?: string }) {
  if (items.length === 0) return <Empty>{emptyText}</Empty>
  return (
    <List>
      {items.map((item) => (
        <Row key={item.key} $kind={item.kind}>
          {item.href ? (
            <Link to={item.href}>
              <RowContent item={item} />
            </Link>
          ) : (
            <div>
              <RowContent item={item} />
            </div>
          )}
        </Row>
      ))}
    </List>
  )
}
