import { Link } from 'react-router-dom'
import styled from 'styled-components'

export const Item = styled(Link)`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.9rem 1rem;
  border: 1px solid var(--card-border);
  border-radius: var(--radius-card);
  background: var(--surface);
  box-shadow: var(--card-shadow);
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

export const Chevron = styled.span`
  color: var(--muted);
  font-size: 1.25rem;
  line-height: 1;
`

// значок пункта: акцентный контур на мягкой подложке; текст после него занимает остаток строки
export const Icon = styled.span`
  display: grid;
  place-items: center;
  flex: none;
  width: 2.25rem;
  height: 2.25rem;
  margin-right: -0.25rem;
  border-radius: 0.7rem;
  background: var(--accent-soft);
  color: var(--accent);

  + span {
    flex: 1;
  }
`
