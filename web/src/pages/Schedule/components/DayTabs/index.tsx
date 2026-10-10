import { Count, Tab, Tabs } from './styles'
import type { DayTabsProps } from './types'
import { WEEKDAYS } from '../../utils'

export function DayTabs({ selected, counts, onSelect }: DayTabsProps) {
  return (
    <Tabs role="tablist" aria-label="День недели">
      {WEEKDAYS.map((day) => (
        <Tab
          key={day.value}
          type="button"
          role="tab"
          aria-selected={selected === day.value}
          aria-label={`${day.full}, уроков: ${counts[day.value] ?? 0}`}
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
