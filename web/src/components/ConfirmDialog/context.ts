import { createContext, useContext } from 'react'
import type { ConfirmFn } from './types'

export const ConfirmContext = createContext<ConfirmFn | null>(null)

// вместо window.confirm: открывает окно подтверждения на всю страницу, возвращает true при согласии
export function useConfirm(): ConfirmFn {
  const confirm = useContext(ConfirmContext)
  if (!confirm) throw new Error('useConfirm must be used inside ConfirmProvider')
  return confirm
}
