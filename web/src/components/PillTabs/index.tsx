import { Count, Item, Nav } from './styles'

export interface PillTab {
  to: string
  label: string
  active: boolean
  // число (например, непрочитанных) рядом с названием
  badge?: number
}

// Переключатель-«таблетка» из двух и более страниц (как «Событие | Чат» в приложении): каждая вкладка это ссылка, переход без записи в историю,
// поэтому «назад» уходит с обеих вкладок сразу на предыдущий экран.
export function PillTabs({ tabs, label }: { tabs: PillTab[]; label: string }) {
  return (
    <Nav aria-label={label}>
      {tabs.map((tab) => (
        <Item key={tab.to} to={tab.to} replace aria-current={tab.active ? 'page' : undefined} $active={tab.active}>
          {tab.label}
          {!!tab.badge && <Count aria-label={`Непрочитанных: ${tab.badge}`}>{tab.badge > 99 ? '99+' : tab.badge}</Count>}
        </Item>
      ))}
    </Nav>
  )
}
