import { NavLink } from 'react-router-dom'
import styled, { css, keyframes } from 'styled-components'

// Плавающая панель, как в Telegram: овал с отступами от краёв экрана и от низа, под ней видно содержимое страницы
export const Bar = styled.nav`
  position: fixed;
  right: 0;
  bottom: calc(var(--tabbar-bottom) + var(--tabbar-gap));
  left: 0;
  z-index: 10;
  width: min(calc(100% - 1.5rem), 26rem);
  height: var(--tabbar-bar-height);
  margin: 0 auto;
  padding: 0 0.3rem;
  border: 1px solid var(--border);
  border-radius: 2rem;
  box-shadow: 0 8px 24px rgb(0 0 0 / 0.22);
  /* полупрозрачная панель: содержимое страницы размыто просвечивает под ней */
  background: var(--glass-bar);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  backdrop-filter: blur(20px) saturate(180%);

  :root[data-keyboard] & {
    display: none;
  }
`

export const Tabs = styled.ul`
  display: grid;
  /* колонки по числу табов */
  grid-auto-flow: column;
  grid-auto-columns: 1fr;
  height: 100%;
  margin: 0;
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
  /* без серой вспышки браузера при нажатии: выделение таба рисуем сами */
  -webkit-tap-highlight-color: transparent;
  user-select: none;
  -webkit-touch-callout: none;

  &.active {
    color: var(--accent);
    font-weight: 600;
  }

  /* выделенный таб: стеклянная капсула в духе iOS (подсветка сверху, тень снизу, размытие фона) */
  &::before {
    content: '';
    position: absolute;
    inset: 0.25rem 0.1rem;
    z-index: -1;
    border-radius: 1.6rem;
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

// при выборе таба значок подпрыгивает и остаётся чуть приподнятым и увеличенным, с мягким свечением акцентного цвета
const pop = keyframes`
  0% {
    transform: translateY(0) scale(0.85);
  }

  45% {
    transform: translateY(-0.3rem) scale(1.35);
  }

  100% {
    transform: translateY(-0.12rem) scale(1.12);
  }
`

// значок рисуется цветом текста таба (серый у обычного, акцентный у выбранного); у выбранного линия чуть толще
export const Icon = styled.span<{ $active: boolean }>`
  display: inline-flex;
  transition: transform 0.25s ease, filter 0.25s ease;

  ${({ $active }) =>
    $active &&
    css`
      transform: translateY(-0.12rem) scale(1.12);
      filter: drop-shadow(0 3px 7px color-mix(in srgb, var(--accent) 55%, transparent));
      animation: ${pop} 0.5s cubic-bezier(0.3, 1.4, 0.5, 1);
    `}

  @media (prefers-reduced-motion: reduce) {
    animation: none;
    transition: none;
  }

  svg {
    width: 1.75rem;
    height: 1.75rem;
    fill: none;
    stroke: currentColor;
    stroke-width: ${({ $active }) => ($active ? 2 : 1.7)};
    stroke-linecap: round;
    stroke-linejoin: round;
  }
`

export const IconWrap = styled.span`
  position: relative;
  display: inline-flex;
`

// число непрочитанных у значка «Чат»
export const Badge = styled.span`
  position: absolute;
  top: -0.3rem;
  right: -0.7rem;
  min-width: 1.1rem;
  height: 1.1rem;
  padding: 0 0.25rem;
  border-radius: 999px;
  background: var(--error);
  color: var(--on-error);
  font-size: 0.65rem;
  font-weight: 700;
  line-height: 1.1rem;
  text-align: center;
`
