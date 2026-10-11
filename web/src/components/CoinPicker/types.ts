export interface CoinPickerProps {
  // число монет строкой (поле «Другая» вводится как текст); '0' и '' — без монет
  value: string
  // выбрана плашка «Другая»: показывается поле для своего числа
  custom: boolean
  onChange: (value: string, custom: boolean) => void
  // подпись группы для скринридера (по умолчанию «Награда»)
  label?: string
  // видимый заголовок
  title?: string
  // подпись плашки «ноль»
  zeroLabel?: string
  // пояснение под плашками
  hint?: string
}
