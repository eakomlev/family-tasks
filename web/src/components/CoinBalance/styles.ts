import { Link } from 'react-router-dom'
import styled from 'styled-components'

export const Chip = styled(Link)`
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  height: 2.25rem;
  padding: 0 0.8rem 0 0.5rem;
  border: 1px solid var(--card-border);
  border-radius: 999px;
  background: var(--surface);
  box-shadow: var(--card-shadow);
  color: var(--text);
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  text-decoration: none;

  &:hover {
    border-color: var(--accent);
  }

  &:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
`

export const Coin = styled.svg`
  width: 1.4rem;
  height: 1.4rem;
  flex: none;
`

export const Card = styled(Link)`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  border: 1px solid var(--card-border);
  border-radius: var(--radius-card);
  background: var(--surface);
  box-shadow: var(--card-shadow);
  color: inherit;
  text-decoration: none;

  svg {
    width: 2rem;
    height: 2rem;
    flex: none;
  }

  &:hover {
    border-color: var(--accent);
  }

  &:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
`

export const CardLabel = styled.span`
  flex: 1;
  font-weight: 600;
`

export const CardValue = styled.strong`
  font-size: 1.25rem;
  font-variant-numeric: tabular-nums;
`

export const Chevron = styled.span`
  color: var(--muted);
  font-size: 1.4rem;
  line-height: 1;
`
