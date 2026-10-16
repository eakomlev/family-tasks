export interface TimePickerProps {
  // подпись над значением: «Начало», «Конец»
  label: string
  // HH:MM
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  // шаг минут на колесе (по умолчанию 5); текущее значение с другими минутами тоже остаётся доступным
  minuteStep?: number
}
