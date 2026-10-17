import { Day, Tile, Weekday } from './styles'

const WEEKDAYS = ['ВС', 'ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ', 'СБ']

// Значок календаря «Квеста»: карточка с коротким днём недели и сегодняшним числом
export function CalendarIcon({ date }: { date: Date }) {
  return (
    <Tile aria-hidden>
      <Weekday>{WEEKDAYS[date.getDay()]}</Weekday>
      <Day>{date.getDate()}</Day>
    </Tile>
  )
}
