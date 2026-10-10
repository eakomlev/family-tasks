export interface DayOption {
  // 1 = понедельник ...
  value: number
  short: string
  full: string
}

export interface DayTabsProps {
  days: DayOption[]
  selected: number
  // сколько записей в каждом дне
  counts: Record<number, number>
  // что считаем, для скринридера: «уроков», «тренировок»
  unit: string
  onSelect: (day: number) => void
}
