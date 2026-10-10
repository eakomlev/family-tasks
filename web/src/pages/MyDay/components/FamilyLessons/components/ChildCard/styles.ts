import { Link } from 'react-router-dom'
import styled from 'styled-components'

export const Card = styled(Link)`
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 0.15rem 0.7rem;
  align-items: center;
  padding: 0.6rem 0.8rem;
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

export const Top = styled.div`
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.75rem;
`

export const Name = styled.strong`
  min-width: 0;
  overflow-wrap: anywhere;
`

export const When = styled.span`
  flex: none;
  color: var(--muted);
  font-size: 0.85rem;
`

export const Subjects = styled.p`
  grid-column: 2;
  font-size: 0.95rem;
  overflow-wrap: anywhere;
`

export const Meta = styled.p`
  grid-column: 2;
  color: var(--muted);
  font-size: 0.8rem;
`
