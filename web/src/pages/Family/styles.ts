import { Link } from 'react-router-dom'
import styled from 'styled-components'

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

export const Members = styled.ul`
  display: grid;
  gap: 0.5rem;
  margin: 0;
  padding: 0;
  list-style: none;
`
