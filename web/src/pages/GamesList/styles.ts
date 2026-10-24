import styled from 'styled-components'

export const List = styled.ul`
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  margin: 0;
  padding: 0;
  list-style: none;
`

export const GameButton = styled.button`
  display: flex;
  align-items: center;
  gap: 0.9rem;
  width: 100%;
  padding: 0.8rem 1rem;
  border: 1px solid var(--card-border);
  border-radius: var(--radius-card);
  background: var(--surface);
  box-shadow: var(--card-shadow);
  color: var(--text);
  font: inherit;
  text-align: left;
  cursor: pointer;

  &:disabled {
    cursor: default;
    opacity: 0.6;
  }

  &:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }

  div {
    flex: 1;
    min-width: 0;
  }

  strong,
  small {
    display: block;
  }

  small {
    color: var(--muted);
  }
`

export const Icon = styled.span`
  display: grid;
  place-items: center;
  flex: none;
  width: 3.2rem;
  height: 3.2rem;
  border-radius: 1rem;
  background: color-mix(in srgb, var(--accent) 16%, transparent);
  font-size: 1.7rem;
`
