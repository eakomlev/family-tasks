import { Link } from 'react-router-dom'
import styled from 'styled-components'

// страница чата: переписка растягивается, поле ввода прижато к панели табов
export const Room = styled.main`
  max-width: 28rem;
  min-height: calc(100dvh - var(--tabbar-height));
  margin: 0 auto;
  padding: calc(1rem + env(safe-area-inset-top)) 1rem 0;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;

  /* клавиатура открыта: панели табов нет, страница по высоте равна видимой области, поэтому поле ввода сидит над клавиатурой */
  /* фон на весь экран: мягкий цветной градиент и узор из значков, рисуется цветом акцента (подходит обеим темам) */
  isolation: isolate;

  &::before,
  &::after {
    content: '';
    position: fixed;
    inset: 0;
    z-index: -1;
    pointer-events: none;
  }

  &::before {
    background:
      radial-gradient(circle at 0% 0%, color-mix(in srgb, var(--accent) 16%, transparent), transparent 55%),
      radial-gradient(circle at 100% 100%, color-mix(in srgb, var(--accent) 12%, transparent), transparent 55%);
  }

  &::after {
    background: var(--accent);
    opacity: 0.09;
    -webkit-mask-image: url("data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22140%22 height=%22140%22 viewBox=%220 0 140 140%22 fill=%22none%22 stroke=%22%23000%22 stroke-width=%222%22 stroke-linecap=%22round%22 stroke-linejoin=%22round%22%3E%3Cpath d=%22M22 30c-6-7 3-14 8-7 5-7 14 0 8 7l-8 8z%22/%3E%3Cpath d=%22M96 20l3 7 8 1-6 5 2 8-7-4-7 4 2-8-6-5 8-1z%22/%3E%3Ccircle cx=%22108%22 cy=%2282%22 r=%227%22/%3E%3Cpath d=%22M30 92v12M24 98h12%22/%3E%3Cpath d=%22M58 60c4-6 8 6 12 0s8 6 12 0%22/%3E%3Cpath d=%22M60 118l8-8 8 8%22/%3E%3Ccircle cx=%2214%22 cy=%2264%22 r=%222.5%22/%3E%3Ccircle cx=%22126%22 cy=%22122%22 r=%222.5%22/%3E%3Cpath d=%22M118 44l6 6M124 44l-6 6%22/%3E%3C/svg%3E");
    mask-image: url("data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22140%22 height=%22140%22 viewBox=%220 0 140 140%22 fill=%22none%22 stroke=%22%23000%22 stroke-width=%222%22 stroke-linecap=%22round%22 stroke-linejoin=%22round%22%3E%3Cpath d=%22M22 30c-6-7 3-14 8-7 5-7 14 0 8 7l-8 8z%22/%3E%3Cpath d=%22M96 20l3 7 8 1-6 5 2 8-7-4-7 4 2-8-6-5 8-1z%22/%3E%3Ccircle cx=%22108%22 cy=%2282%22 r=%227%22/%3E%3Cpath d=%22M30 92v12M24 98h12%22/%3E%3Cpath d=%22M58 60c4-6 8 6 12 0s8 6 12 0%22/%3E%3Cpath d=%22M60 118l8-8 8 8%22/%3E%3Ccircle cx=%2214%22 cy=%2264%22 r=%222.5%22/%3E%3Ccircle cx=%22126%22 cy=%22122%22 r=%222.5%22/%3E%3Cpath d=%22M118 44l6 6M124 44l-6 6%22/%3E%3C/svg%3E");
    -webkit-mask-size: 140px 140px;
    mask-size: 140px 140px;
  }

  :root[data-keyboard] && {
    min-height: var(--vvh, 100dvh);
  }
`

// закреплена сверху: при прокрутке переписки не уезжает (фон закрывает сообщения под ней)
export const Header = styled.header`
  position: sticky;
  top: 0;
  z-index: 6;
  margin: calc(-1rem - env(safe-area-inset-top)) -1rem 0;
  padding: calc(1rem + env(safe-area-inset-top)) 1rem 0.6rem;
  border-bottom: 1px solid var(--border);
  background: var(--glass-bar);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  backdrop-filter: blur(20px) saturate(180%);
  display: flex;
  align-items: center;
  gap: 0.75rem;
  /* справа вверху лежит значок профиля */
  padding-right: calc(1rem + var(--topbar-reserve, 3rem));

  h1 {
    margin: 0;
    font-size: 1.25rem;
    min-width: 0;
    overflow-wrap: anywhere;
  }
`

// стрелка выхода из переписки слева от аватара собеседника
export const BackButton = styled(Link)`
  flex: none;
  display: grid;
  place-items: center;
  width: 2rem;
  height: 2.25rem;
  margin-left: -0.4rem;
  color: var(--accent);

  svg {
    width: 1.5rem;
    height: 1.5rem;
    fill: none;
    stroke: currentColor;
    stroke-width: 2.2;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  &:focus-visible {
    outline: 2px solid var(--accent);
    border-radius: 0.5rem;
  }
`

export const FamilyIcon = styled.span`
  flex: none;
  display: grid;
  place-items: center;
  width: 2.25rem;
  height: 2.25rem;
  border-radius: 50%;
  background: color-mix(in srgb, var(--accent) 16%, transparent);
`

// Сообщения прижаты к низу, к полю ввода: когда их мало (или открыта клавиатура), они остаются на виду рядом с ним.
export const Feed = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  gap: 0.25rem;
  padding-bottom: 0.5rem;

  /* сообщения одного дня: между ними заметный промежуток */
  section {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }
`

export const DayLabel = styled.div`
  align-self: center;
  margin: 0.6rem 0 0.2rem;
  padding: 0.15rem 0.7rem;
  border-radius: 999px;
  background: color-mix(in srgb, var(--muted) 16%, transparent);
  color: var(--muted);
  font-size: 0.75rem;
`

export const Empty = styled.p`
  margin: auto;
  color: var(--muted);
  text-align: center;
`
