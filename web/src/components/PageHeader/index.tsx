import type { ReactNode } from 'react'
import { Back, Bar, Right } from './styles'

export { BodyTitle } from './styles'

interface PageHeaderProps {
  // куда вести, если вернуться по истории нельзя (открыли ссылку, уведомление)
  to: string
  children: ReactNode
  // действие справа (например, «Изменить»)
  right?: ReactNode
}

// Шапка вложенной страницы: стрелка «назад» (возвращает туда, откуда пришли) и заголовок страницы на одной строке.
export function PageHeader({ to, children, right }: PageHeaderProps) {
  return (
    <Bar $reserve={!right}>
      <Back to={to} aria-label="Назад">
        <svg viewBox="0 0 24 24" aria-hidden focusable="false">
          <path d="M15 5l-7 7 7 7" />
        </svg>
      </Back>
      <h1>{children}</h1>
      {right && <Right>{right}</Right>}
    </Bar>
  )
}
