import styled from 'styled-components'

// на весь экран поверх переписки; тёмный фон независимо от темы приложения, чтобы фото не «светилось» на белом
export const Overlay = styled.div`
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  flex-direction: column;
  background: #050505;
  color: #fff;
  -webkit-user-select: none;
  user-select: none;
`

export const TopBar = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: calc(0.6rem + env(safe-area-inset-top)) 0.9rem 0.6rem;

  span {
    flex: 1;
    font-size: 0.9rem;
    opacity: 0.8;
  }
`

const control = `
  display: inline-grid;
  place-items: center;
  min-width: 2.5rem;
  height: 2.5rem;
  padding: 0 0.6rem;
  border: 0;
  border-radius: 999px;
  background: rgb(255 255 255 / 0.14);
  color: #fff;
  font: inherit;
  font-size: 0.9rem;
  text-decoration: none;
  cursor: pointer;

  svg {
    width: 1.3rem;
    height: 1.3rem;
    fill: none;
    stroke: currentColor;
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  &:focus-visible {
    outline: 2px solid #fff;
    outline-offset: 2px;
  }
`

export const IconButton = styled.button`
  ${control}
`

export const SaveButton = styled.button`
  ${control}

  &:disabled {
    opacity: 0.6;
    cursor: progress;
  }
`

export const Status = styled.p`
  margin: 0;
  padding: 0.4rem 0.9rem;
  background: rgb(198 40 40 / 0.85);
  color: #fff;
  font-size: 0.85rem;
  text-align: center;
`

export const Stage = styled.div`
  position: relative;
  flex: 1;
  min-height: 0;
  margin-bottom: env(safe-area-inset-bottom);
`

// Лента слайдов: свой горизонтальный скролл с привязкой к краям, палец тянет фото за собой, как слайдер
export const Track = styled.div`
  position: absolute;
  inset: 0;
  display: flex;
  overflow-x: auto;
  overflow-y: hidden;
  scroll-snap-type: x mandatory;
  overscroll-behavior-x: contain;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;

  &::-webkit-scrollbar {
    display: none;
  }
`

export const Slide = styled.div`
  flex: 0 0 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  scroll-snap-align: center;
  /* быстрый жест не пролистывает несколько фото сразу */
  scroll-snap-stop: always;

  /* фото целиком в границах слайда, без обрезки; пустое место вокруг фото закрывает просмотр */
  img {
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
    -webkit-user-drag: none;
  }
`

export const Arrow = styled.button<{ $side: 'left' | 'right' }>`
  ${control}
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  ${({ $side }) => ($side === 'left' ? 'left: 0.6rem;' : 'right: 0.6rem;')}
`
