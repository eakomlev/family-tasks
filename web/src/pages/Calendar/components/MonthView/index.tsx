import { useMemo } from 'react'
import { eachDay, endOfWeek, endOfMonth, startOfMonth, startOfWeek, type CalendarItem } from '@/lib/calendar'
import { formatDayHeading } from '@/lib/calendar'
import type { CalendarKind } from '@/lib/calendarSettings'
import { holidayOn } from '@/lib/holidays'
import { isoWeekdayOf } from '@/lib/date'
import { WEEK_DAYS } from '@/lib/weekdays'
import { Cell, Dot, Dots, MonthGrid, WeekdayName } from '../../styles'

const DOT_ORDER: CalendarKind[] = ['holiday', 'birthday', 'event', 'training', 'task']

// Месяц сеткой целых недель. В ячейке число и точки по видам записей (не больше пяти); нажатие выбирает день.
export function MonthView({
  anchor,
  today,
  byDay,
  onSelect,
}: {
  anchor: string
  today: string
  byDay: Map<string, CalendarItem[]>
  onSelect: (day: string) => void
}) {
  const days = useMemo(() => eachDay(startOfWeek(startOfMonth(anchor)), endOfWeek(endOfMonth(anchor))), [anchor])
  const month = anchor.slice(0, 7)

  return (
    <MonthGrid role="grid" aria-label="Месяц">
      {WEEK_DAYS.map((day) => (
        <WeekdayName key={day.value} $weekend={day.value >= 6} role="columnheader">
          {day.short}
        </WeekdayName>
      ))}
      {days.map((day) => {
        const items = byDay.get(day) ?? []
        const kinds = DOT_ORDER.filter((kind) => items.some((item) => item.kind === kind))
        return (
          <Cell
            key={day}
            type="button"
            role="gridcell"
            aria-label={`${formatDayHeading(day)}${items.length > 0 ? `, записей: ${items.length}` : ''}`}
            aria-current={day === today ? 'date' : undefined}
            aria-selected={day === anchor}
            $today={day === today}
            $selected={day === anchor}
            $outside={day.slice(0, 7) !== month}
            $dayOff={isoWeekdayOf(day) >= 6 || holidayOn(day) !== null}
            onClick={() => onSelect(day)}
          >
            <span>{Number(day.slice(8, 10))}</span>
            <Dots aria-hidden>
              {kinds.map((kind) => (
                <Dot key={kind} $kind={kind} />
              ))}
            </Dots>
          </Cell>
        )
      })}
    </MonthGrid>
  )
}
