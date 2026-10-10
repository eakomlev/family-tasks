import { Link } from 'react-router-dom'
import styled from 'styled-components'

export const Row = styled.li`
  list-style: none;
`

// вся карточка — ссылка: на свой профиль или на превью участника
export const Card = styled(Link)`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.6rem 1rem;
  border: 1px solid var(--border);
  border-radius: 0.8rem;
  background: var(--surface);
  color: inherit;
  text-decoration: none;

  &:hover {
    border-color: var(--accent);
  }

  &:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
`

export const Name = styled.span`
  flex: 1;
  min-width: 0;
  overflow-wrap: anywhere;
`
