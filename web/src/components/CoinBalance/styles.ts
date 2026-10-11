import { Link } from 'react-router-dom'
import styled from 'styled-components'

export const Chip = styled(Link)`
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  height: 2.25rem;
  padding: 0 0.8rem 0 0.5rem;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--surface);
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
