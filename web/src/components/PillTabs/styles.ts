import { Link } from 'react-router-dom'
import styled from 'styled-components'

export const Nav = styled.nav`
  display: flex;
  gap: 0.25rem;
  padding: 0.25rem;
  border: 1px solid var(--card-border, var(--border));
  border-radius: 999px;
  background: var(--surface);
`

export const Item = styled(Link)<{ $active: boolean }>`
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  padding: 0.45rem 0.8rem;
  border-radius: 999px;
  background: ${({ $active }) => ($active ? 'var(--tabbar-active-bg)' : 'transparent')};
  color: ${({ $active }) => ($active ? 'var(--tabbar-active-text)' : 'var(--muted)')};
  font-weight: 800;
  text-decoration: none;
  -webkit-tap-highlight-color: transparent;

  &:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
`

export const Count = styled.span`
  min-width: 1.2rem;
  padding: 0 0.3rem;
  border-radius: 999px;
  background: var(--error);
  color: var(--on-error);
  font-size: 0.7rem;
  line-height: 1.2rem;
  text-align: center;
`
