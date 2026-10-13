import styled from 'styled-components'

// на весь экран поверх переписки; тёмный фон независимо от темы приложения, чтобы фото не «светилось» на белом
export const Overlay = styled.div`
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  flex-direction: column;
  background: rgb(0 0 0 / 0.97);
  color: #fff;
  touch-action: pan-y;
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

export const SaveLink = styled.a`
  ${control}
`

export const Stage = styled.div`
  position: relative;
  flex: 1;
  min-height: 0;
  margin-bottom: env(safe-area-inset-bottom);

  /* фото целиком в границах области, без обрезки и прокрутки: процентные высоты внутри flex-области ненадёжны, поэтому абсолютно */
  img {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: contain;
  }
`

export const Arrow = styled.button<{ $side: 'left' | 'right' }>`
  ${control}
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  ${({ $side }) => ($side === 'left' ? 'left: 0.6rem;' : 'right: 0.6rem;')}
`
