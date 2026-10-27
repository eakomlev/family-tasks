import type { ReactNode } from 'react'

export interface MenuLinkProps {
  to: string
  children: ReactNode
  // значок слева (контурный, цветом акцента)
  icon?: ReactNode
}
