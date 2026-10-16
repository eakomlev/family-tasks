import type { ComponentProps, MouseEvent } from 'react'
import { Link, useLocation, useNavigate, type Location } from 'react-router-dom'
import styled from 'styled-components'
import { BACK_STATE } from '@/lib/useSlideIn'

const StyledLink = styled(Link)`
  align-self: flex-start;
  color: var(--accent);
  text-decoration: none;

  &:hover {
    text-decoration: underline;
  }
`

// Есть ли предыдущая запись истории внутри приложения. BrowserRouter хранит номер записи в history.state.idx (0: первая, назад
// некуда, кроме чужого сайта); в тестах с MemoryRouter его нет, там судим по ключу адреса (у самого первого он 'default').
function canGoBack(location: Location): boolean {
  const idx = (window.history.state as { idx?: unknown } | null)?.idx
  return typeof idx === 'number' ? idx > 0 : location.key !== 'default'
}

// Ссылка «назад»: возвращает на страницу, с которой пришли (календарь, список заданий, семья…), вместе с её адресом, видом и днём.
// Если пришли не из приложения (открыли ссылку, уведомление), ведёт на страницу `to`. Страница, на которую вернулись, не выезжает справа.
export function BackLink({ to, onClick, ...props }: ComponentProps<typeof Link>) {
  const navigate = useNavigate()
  const location = useLocation()

  function handleClick(e: MouseEvent<HTMLAnchorElement>) {
    onClick?.(e)
    // обычный клик; открытие в новой вкладке и с клавишами-модификаторами остаётся ссылкой на `to`
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || props.target === '_blank') return
    if (canGoBack(location)) {
      e.preventDefault()
      navigate(-1)
    }
  }

  return <StyledLink to={to} state={BACK_STATE} onClick={handleClick} {...props} />
}
