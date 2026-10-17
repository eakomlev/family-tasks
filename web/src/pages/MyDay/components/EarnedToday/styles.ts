import { Link } from 'react-router-dom'
import styled from 'styled-components'

// сверху страницы: сколько монет заработано сегодня; нажатие открывает историю
export const Banner = styled(Link)`
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
    border-color: var(--coin);
  }

  &:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
`

export const Text = styled.span`
  display: flex;
  flex-direction: column;
  color: var(--muted);
  font-size: 0.9rem;
`

export const Amount = styled.strong`
  color: var(--text);
  font-size: 1.25rem;
`
