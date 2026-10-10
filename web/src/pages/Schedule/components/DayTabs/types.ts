export interface DayTabsProps {
  selected: number
  // сколько уроков в каждом дне
  counts: Record<number, number>
  onSelect: (day: number) => void
}
