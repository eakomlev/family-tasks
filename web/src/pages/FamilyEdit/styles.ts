import { Link } from 'react-router-dom'
import styled from 'styled-components'

export const List = styled.ul`
  display: grid;
  gap: 0.5rem;
  margin: 0;
  padding: 0;
  list-style: none;
`

export const Row = styled.li`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.6rem 1rem;
  border: 1px solid var(--card-border);
  border-radius: var(--radius-card);
  background: var(--surface);
  box-shadow: var(--card-shadow);
`

export const Name = styled.span`
  flex: 1;
  min-width: 0;
  font-weight: 800;
  overflow-wrap: anywhere;

  small {
    display: block;
    font-weight: 400;
    color: var(--muted);
  }
`

// ссылка в самом низу страницы, заметная, но не кнопка: удалять семью нужно осознанно
export const DeleteLink = styled(Link)`
  align-self: center;
  margin-top: 2rem;
  padding: 0.5rem 0.75rem;
  color: var(--error);
  font-size: 0.9rem;
  text-decoration: none;

  &:hover {
    text-decoration: underline;
  }

  &:focus-visible {
    outline: 2px solid var(--error);
    outline-offset: 2px;
    border-radius: 0.4rem;
  }
`
