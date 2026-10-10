import { Chevron, Item } from './styles'
import type { MenuLinkProps } from './types'

// строка меню: пункт со стрелкой, ведёт на другую страницу
export function MenuLink({ to, children }: MenuLinkProps) {
  return (
    <Item to={to}>
      <span>{children}</span>
      <Chevron aria-hidden>›</Chevron>
    </Item>
  )
}
