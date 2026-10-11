import type { InputHTMLAttributes, ReactNode } from 'react'
import { Box, Label } from './styles'

// флажок с подписью: клик по подписи тоже переключает
export function Checkbox({ children, ...props }: { children: ReactNode } & Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>) {
  return (
    <Label>
      <Box type="checkbox" {...props} />
      <span>{children}</span>
    </Label>
  )
}
