import { Chevron, Icon, Item } from './styles'
import type { MenuLinkProps } from './types'

// строка меню: пункт со стрелкой, ведёт на другую страницу
export function MenuLink({ to, children, icon }: MenuLinkProps) {
  return (
    <Item to={to}>
      {icon && <Icon aria-hidden>{icon}</Icon>}
      <span>{children}</span>
      <Chevron aria-hidden>›</Chevron>
    </Item>
  )
}
