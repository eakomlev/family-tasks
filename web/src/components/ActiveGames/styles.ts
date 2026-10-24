import { Link } from 'react-router-dom'
import styled from 'styled-components'

export const Section = styled.section`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;

  h2 {
    margin: 0;
  }
`

export const List = styled.ul`
  display: flex;
  flex-direction: column;
  margin: 0;
  padding: 0.3rem 0.8rem;
  border: 1px solid var(--card-border);
  border-radius: var(--radius-card);
  background: var(--surface);
  box-shadow: var(--card-shadow);
  list-style: none;
`

export const Row = styled(Link)`
  display: flex;
  align-items: center;
  gap: 0.8rem;
  padding: 0.55rem 0;
  color: var(--text);
  text-decoration: none;

  div {
    min-width: 0;
  }

  strong,
  small {
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  small {
    color: var(--muted);
  }

  &[data-mine='true'] small {
    color: var(--accent);
    font-weight: 700;
  }

  &:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
`
