import { Link } from 'react-router-dom'
import { BACK_STATE } from '@/lib/useSlideIn'
import styled, { css, keyframes } from 'styled-components'

// переписка выезжает справа, как в мессенджерах
const slideIn = keyframes`
  from {
    transform: translateX(100%);
  }

  to {
    transform: none;
  }
`

// Экран переписки стоит ровно на видимой области (useKeyboardViewport: --vv-top и --vvh), а прокручивается только
// лента внутри него. Страница сама не прокручивается: так открытая клавиатура не уводит поле ввода под себя и браузеру
// нечего «подтягивать» в кадр. Шапка сверху, поле ввода снизу, между ними лента.
export const Room = styled.main<{ $slide?: boolean }>`
  position: fixed;
  top: var(--vv-top, 0px);
  left: 0;
  right: 0;
  height: var(--vvh, 100dvh);
  max-width: 28rem;
  margin: 0 auto;
  padding: 0 1rem var(--tabbar-height);
  display: flex;
  flex-direction: column;

  /* фон на весь экран: мягкий цветной градиент и узор из значков, рисуется цветом акцента (подходит обеим темам) */
  isolation: isolate;
  /* выезжает только при переходе вперёд; при возврате (кнопка «назад») без анимации */
  ${({ $slide }) => ($slide ? css`animation: ${slideIn} 0.28s cubic-bezier(0.2, 0.8, 0.2, 1);` : '')}

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }

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

  /* Content в AppShell задаёт каждой странице (> main) min-height во весь экран, а он сильнее height: клавиатура не
     меняет dvh, и без этого экран оставался во весь рост, а поле ввода и конец переписки уходили под клавиатуру
     (&& поднимает специфичность выше правила Content) */
  && {
    min-height: 0;
  }

  /* клавиатура открыта: индикатор «Домой» закрыт клавиатурой, отступ под него не нужен */
  :root[data-keyboard] && {
    padding-bottom: 0;
  }
`

// сверху экрана, прокручивается только лента под ней
export const Header = styled.header`
  flex: none;
  position: relative;
  z-index: 6;
  margin: 0 -1rem;
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
export const BackButton = styled(Link).attrs({ state: BACK_STATE })`
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

// имя собеседника и под ним, когда он был в чате
export const Title = styled.div`
  min-width: 0;

  small {
    display: block;
    color: var(--muted);
    font-size: 0.75rem;
  }
`

// аватар и имя собеседника в шапке: в личной переписке это ссылка на его профиль, в общем чате просто блок
const whoStyle = css`
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  color: inherit;
  text-decoration: none;
`

export const Who = styled.div`
  ${whoStyle}
`

export const WhoLink = styled(Link)`
  ${whoStyle}
  border-radius: 0.6rem;

  &:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
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
  color: var(--accent);

  /* контурный значок в стиле иконок табов: цвет текста, линия 1,8, круглые окончания */
  svg {
    width: 56%;
    height: 56%;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.8;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
`

// Лента: своя прокрутка между шапкой и полем ввода (на всю ширину экрана, чтобы прокручивать можно было и у краёв).
export const Feed = styled.div`
  /* сообщение, к которому перешли из поиска, коротко подсвечивается */
  [data-message-id][data-found] > div:first-child {
    animation: found-flash 1.8s ease-out;
  }

  @keyframes found-flash {
    0%,
    60% {
      box-shadow: 0 0 0 3px var(--accent);
    }

    100% {
      box-shadow: 0 0 0 3px transparent;
    }
  }

  flex: 1;
  min-height: 0;
  margin: 0 -1rem;
  padding: 0 1rem;
  overflow-y: auto;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
`

// Сообщения прижаты к низу, к полю ввода: когда их мало (или открыта клавиатура), они остаются на виду рядом с ним.
// justify-content: flex-end стоит на внутреннем блоке высотой не меньше ленты, а не на самой прокручиваемой ленте:
// там он делает недоступной для прокрутки ту часть, что выше верха.
export const FeedContent = styled.div`
  min-height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  gap: 0.25rem;
  padding: 0.75rem 0 0.5rem;

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

// три точки справа в шапке: меню чата (уведомления, очистка)
export const MenuButton = styled.button`
  flex: none;
  display: grid;
  place-items: center;
  width: 2.25rem;
  height: 2.25rem;
  margin-left: auto;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: var(--text);
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;

  svg {
    width: 1.4rem;
    height: 1.4rem;
    fill: currentColor;
  }

  &:active {
    background: color-mix(in srgb, var(--accent) 12%, transparent);
  }

  &:focus-visible {
    outline: 2px solid var(--accent);
  }
`
