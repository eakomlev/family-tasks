import { Count, Tab, Tabs } from './styles'
import type { DayTabsProps } from './types'

// вкладки дней недели со счётчиком записей в каждом
export function DayTabs({ days, selected, counts, unit, onSelect }: DayTabsProps) {
  return (
    <Tabs role="tablist" aria-label="День недели" $columns={days.length}>
      {days.map((day) => (
        <Tab
          key={day.value}
          type="button"
          role="tab"
          aria-selected={selected === day.value}
          aria-label={`${day.full}, ${unit}: ${counts[day.value] ?? 0}`}
          $active={selected === day.value}
          onClick={() => onSelect(day.value)}
        >
          {day.short}
          <Count>{counts[day.value] || '·'}</Count>
        </Tab>
      ))}
    </Tabs>
  )
}
