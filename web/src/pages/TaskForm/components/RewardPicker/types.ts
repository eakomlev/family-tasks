export interface RewardPickerProps {
  // число монет строкой (поле «Другая» вводится как текст); '0' и '' — без награды
  value: string
  // выбрана плашка «Другая»: показывается поле для своего числа
  custom: boolean
  onChange: (value: string, custom: boolean) => void
}
