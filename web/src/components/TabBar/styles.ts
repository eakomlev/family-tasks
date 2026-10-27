import { NavLink } from 'react-router-dom'
import styled, { css, keyframes } from 'styled-components'

// Плавающая тёмная «таблетка» («Квест»): овал с отступами от краёв экрана и от низа, под ней видно содержимое страницы
export const Bar = styled.nav`
  position: fixed;
  right: 0;
  bottom: calc(var(--tabbar-bottom) + var(--tabbar-gap));
  left: 0;
  z-index: 10;
  width: min(calc(100% - 1.5rem), 26rem);
  height: var(--tabbar-bar-height);
  margin: 0 auto;
  padding: 0.3rem;
  border: 1px solid var(--tabbar-border);
  border-radius: 999px;
  background: var(--tabbar-bg);
  -webkit-backdrop-filter: blur(10px);
  backdrop-filter: blur(10px);
  box-shadow: var(--tabbar-shadow);

  :root[data-keyboard] & {
    display: none;
  }
`

// выбранный таб шире (значок и подпись), остальные только значками: место делится поровну между ними
export const Tabs = styled.ul`
  position: relative;
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: 1fr;
  gap: 4px;
  height: 100%;
  margin: 0;
  padding: 0;
  list-style: none;

  li {
    display: flex;
  }
`

// подсветка выбранного таба: плавно переезжает между равными колонками
export const Highlight = styled.li<{ $index: number; $count: number }>`
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  width: calc((100% - 4px * (${({ $count }) => $count} - 1)) / ${({ $count }) => $count});
  border-radius: 999px;
  background: var(--tabbar-active-bg);
  transform: translateX(calc(${({ $index }) => $index} * (100% + 4px)));
  transition: transform 0.28s cubic-bezier(0.3, 1.2, 0.5, 1);
  pointer-events: none;

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`

export const TabLink = styled(NavLink)`
  position: relative;
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1px;
  border-radius: 999px;
  color: var(--tabbar-icon);
  font-size: 0.7rem;
  font-weight: 800;
  text-decoration: none;
  white-space: nowrap;
  /* без серой вспышки браузера при нажатии */
  -webkit-tap-highlight-color: transparent;
  user-select: none;
  -webkit-touch-callout: none;
  transition: color 0.2s ease;

  &.active {
    color: var(--tabbar-active-text);
  }

  &:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
`

// подпись видна у всех табов
export const Label = styled.span<{ $active: boolean }>`
  line-height: 1.1;
`

// при выборе таба значок подпрыгивает
const pop = keyframes`
  0% {
    transform: scale(0.8);
  }

  50% {
    transform: scale(1.25);
  }

  100% {
    transform: none;
  }
`

// значок рисуется цветом текста таба
export const Icon = styled.span<{ $active: boolean }>`
  display: inline-flex;

  ${({ $active }) =>
    $active &&
    css`
      animation: ${pop} 0.45s cubic-bezier(0.3, 1.4, 0.5, 1);
    `}

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }

  svg {
    width: 1.45rem;
    height: 1.45rem;
    fill: none;
    stroke: currentColor;
    stroke-width: 2.2;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
`

export const IconWrap = styled.span`
  position: relative;
  display: inline-flex;
`

// число непрочитанных у значка «Чат» и заданий у «Задач»
export const Badge = styled.span`
  position: absolute;
  top: -0.35rem;
  right: -0.6rem;
  min-width: 1.1rem;
  height: 1.1rem;
  padding: 0 0.25rem;
  border: 2px solid var(--tabbar-bg-solid);
  border-radius: 999px;
  box-sizing: content-box;
  background: var(--error);
  color: var(--on-error);
  font-size: 0.65rem;
  font-weight: 900;
  line-height: 1.1rem;
  text-align: center;

  ${TabLink}.active & {
    border-color: var(--tabbar-active-bg);
  }
`
