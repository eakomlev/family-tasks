import type { SheetAction } from '@/components/ActionSheet/types'

export interface MenuAction extends SheetAction {
  // пункт-переключатель: флажок слева, отмечен, когда включён
  checked?: boolean
}

export interface MenuButtonProps {
  actions: MenuAction[]
  label?: string
}
