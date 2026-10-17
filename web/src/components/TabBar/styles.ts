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
  padding: 0 0.5rem;
  border: 1px solid var(--tabbar-border);
  border-radius: 999px;
  background: var(--tabbar-bg);
  box-shadow: var(--tabbar-shadow);

  :root[data-keyboard] & {
    display: none;
  }
`

// выбранный таб шире (значок и подпись), остальные только значками: место делится поровну между ними
export const Tabs = styled.ul`
  display: flex;
  align-items: center;
  justify-content: space-around;
  height: 100%;
  margin: 0;
  padding: 0;
  list-style: none;
`

export const TabLink = styled(NavLink)`
  position: relative;
  min-width: 2.75rem;
  height: 2.75rem;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  padding: 0 0.5rem;
  border-radius: 999px;
  color: var(--tabbar-icon);
  font-size: 0.8rem;
  font-weight: 900;
  text-decoration: none;
  white-space: nowrap;
  /* без серой вспышки браузера при нажатии: выделение таба рисуем сами */
  -webkit-tap-highlight-color: transparent;
  user-select: none;
  -webkit-touch-callout: none;
  transition: background-color 0.2s ease, padding 0.25s cubic-bezier(0.3, 1.4, 0.5, 1);

  /* выбранный таб: лаймовая капсула со значком и подписью */
  &.active {
    padding: 0 1rem 0 0.8rem;
    background: var(--lime);
    color: var(--on-lime);
  }

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }

  &:focus-visible {
    outline: 2px solid var(--lime);
    outline-offset: 2px;
  }
`

// подпись видна только у выбранного таба; у остальных она остаётся для скринридеров
export const Label = styled.span<{ $active: boolean }>`
  ${({ $active }) =>
    !$active &&
    css`
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip-path: inset(50%);
    `}
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
    width: ${({ $active }) => ($active ? '1.35rem' : '1.55rem')};
    height: ${({ $active }) => ($active ? '1.35rem' : '1.55rem')};
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
  border: 2px solid var(--tabbar-bg);
  border-radius: 999px;
  box-sizing: content-box;
  background: var(--error);
  color: var(--on-error);
  font-size: 0.65rem;
  font-weight: 900;
  line-height: 1.1rem;
  text-align: center;

  /* у выбранного таба справа от значка подпись, поэтому число переезжает на левый край значка */
  ${TabLink}.active & {
    right: auto;
    left: -0.75rem;
    border-color: var(--lime);
  }
`
