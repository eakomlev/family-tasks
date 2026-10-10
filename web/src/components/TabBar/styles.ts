import { NavLink } from 'react-router-dom'
import styled from 'styled-components'

export const Bar = styled.nav`
  position: fixed;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 10;
  height: var(--tabbar-height);
  padding-bottom: env(safe-area-inset-bottom);
  border-top: 1px solid var(--border);
  background: var(--surface);
`

export const Tabs = styled.ul`
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  max-width: 28rem;
  height: 100%;
  margin: 0 auto;
  padding: 0;
  list-style: none;
`

export const TabLink = styled(NavLink)`
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.15rem;
  color: var(--muted);
  font-size: 0.7rem;
  text-decoration: none;

  &.active {
    color: var(--accent);
    font-weight: 600;
  }

  &:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: -2px;
  }
`

export const Icon = styled.span<{ $active: boolean }>`
  font-size: 1.4rem;
  line-height: 1;
  opacity: ${({ $active }) => ($active ? 1 : 0.55)};
`
