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
  /* полупрозрачная панель: содержимое страницы размыто просвечивает под ней */
  background: var(--glass-bar);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  backdrop-filter: blur(20px) saturate(180%);
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
  position: relative;
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

  /* выделенный таб: стеклянная капсула в духе iOS (подсветка сверху, тень снизу, размытие фона) */
  &::before {
    content: '';
    position: absolute;
    inset: 0.3rem 0.2rem;
    z-index: -1;
    border-radius: 1.2rem;
    background:
      linear-gradient(180deg, var(--glass-edge) 0%, transparent 55%),
      var(--glass-tint);
    -webkit-backdrop-filter: blur(12px) saturate(200%);
    backdrop-filter: blur(12px) saturate(200%);
    box-shadow:
      0 0 0 0.5px var(--glass-ring),
      inset 0 1px 0 var(--glass-edge),
      inset 0 -1px 0 rgb(255 255 255 / 0.08),
      0 2px 10px var(--glass-shade);
    opacity: 0;
    transform: scale(0.85);
    transition: opacity 0.2s ease, transform 0.25s cubic-bezier(0.3, 1.4, 0.5, 1);
  }

  &.active::before {
    opacity: 1;
    transform: none;
  }

  @media (prefers-reduced-motion: reduce) {
    &::before {
      transition: none;
    }
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
