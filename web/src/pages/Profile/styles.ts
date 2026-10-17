import { Link } from 'react-router-dom'
import styled from 'styled-components'

// заголовок и «Изменить» справа; справа вверху оболочки может лежать баланс монет ребёнка
export const Header = styled.header`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding-right: var(--topbar-reserve, 0);

  h1 {
    margin: 0;
  }
`

export const EditLink = styled(Link)`
  color: var(--accent);
  text-decoration: none;
  font-weight: 600;

  &:hover {
    text-decoration: underline;
  }

  &:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
    border-radius: 0.3rem;
  }
`

export const Hero = styled.section`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.4rem;
  text-align: center;

  h2 {
    margin: 0.25rem 0 0;
    overflow-wrap: anywhere;
  }
`

export const Badge = styled.span`
  padding: 0.2rem 0.7rem;
  border: 1px solid var(--card-border);
  border-radius: 999px;
  background: var(--surface);
  box-shadow: var(--card-shadow);
  color: var(--muted);
  font-size: 0.85rem;
`

// дата рождения и email мелким серым текстом
export const Facts = styled.ul`
  display: grid;
  gap: 0.2rem;
  margin: 0;
  padding: 0;
  list-style: none;
  color: var(--muted);
  text-align: center;
  overflow-wrap: anywhere;
`

export const Menu = styled.nav`
  display: grid;
  gap: 0.5rem;
`

// «Выйти» в самом низу страницы: при коротком содержимом прижата к низу экрана, при длинном просто последняя
export const LogoutBox = styled.div`
  margin-top: auto;
  padding-top: 1.5rem;
`
