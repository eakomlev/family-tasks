export interface MoodDialogProps {
  // выбранное сейчас настроение (подсвечивается)
  current?: number
  // принудительный показ утром: закрыть нельзя, пока не выбрано
  forced?: boolean
  // сохраняет выбор; бросает ошибку, если не вышло (окно остаётся открытым)
  onPick: (mood: number) => Promise<void>
  onClose: () => void
}
