import { Link } from 'react-router-dom'
import styled from 'styled-components'

export const List = styled.ol`
  display: grid;
  gap: 0.5rem;
  margin: 0;
  padding: 0;
  list-style: none;
`

export const Item = styled.li<{ $link?: boolean }>`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: ${({ $link }) => ($link ? '0' : '0.75rem 1rem')};
  border: 1px solid var(--border);
  border-radius: 0.8rem;
  background: var(--surface);

  &:hover {
    border-color: ${({ $link }) => ($link ? 'var(--accent)' : 'var(--border)')};
  }
`

// строка урока целиком ссылка
export const RowLink = styled(Link)`
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  border-radius: 0.8rem;
  color: inherit;
  text-decoration: none;

  &:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
`

export const Number = styled.span`
  width: 1.75rem;
  height: 1.75rem;
  flex: none;
  display: grid;
  place-items: center;
  border-radius: 50%;
  background: var(--bg);
  color: var(--muted);
  font-size: 0.85rem;
  font-weight: 600;
`

export const Subject = styled.span`
  flex: 1;
  min-width: 0;
  overflow-wrap: anywhere;
`

export const Time = styled.span`
  flex: none;
  color: var(--muted);
  font-size: 0.9rem;
  font-variant-numeric: tabular-nums;
`

export const Chevron = styled.span`
  flex: none;
  color: var(--muted);
  font-size: 1.4rem;
  line-height: 1;
`
