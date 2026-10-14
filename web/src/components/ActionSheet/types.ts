export interface SheetAction {
  key: string
  label: string
  // опасное действие (красный текст)
  danger?: boolean
  // выполняется при нажатии; пока идёт, меню занято, при ошибке остаётся открытым и показывает сообщение, при успехе закрывается
  onSelect: () => Promise<void> | void
}

export interface ActionSheetProps {
  title?: string
  actions: SheetAction[]
  onClose: () => void
}
