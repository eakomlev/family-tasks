import styled from 'styled-components'

// контейнер задаёт размер для шрифта фигур (cqw: доля ширины доски)
export const Frame = styled.div`
  width: 100%;
  position: relative;
  max-width: 28rem;
  margin: 0 auto;
  container-type: inline-size;
`

export const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(8, minmax(0, 1fr));
  /* строки равные, иначе ряд без фигур сжимается до высоты пустой клетки */
  grid-template-rows: repeat(8, minmax(0, 1fr));
  aspect-ratio: 1;
  overflow: hidden;
  border-radius: 0.4rem;
`

export const Square = styled.button<{ $dark: boolean; $mark?: 'last' | 'selected' | 'check' }>`
  position: relative;
  display: grid;
  place-items: center;
  min-width: 0;
  min-height: 0;
  padding: 0;
  border: 0;
  background: ${({ $dark }) => ($dark ? '#a9835a' : '#eadfc8')};
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;

  &::before {
    content: '';
    position: absolute;
    inset: 0;
    background: ${({ $mark }) => ($mark === 'check' ? 'rgb(230 40 40 / 0.65)' : $mark === 'selected' ? 'rgb(75 59 255 / 0.45)' : $mark === 'last' ? 'rgb(255 214 10 / 0.55)' : 'transparent')};
    pointer-events: none;
  }

  &:focus-visible {
    outline: 3px solid var(--accent);
    outline-offset: -3px;
    z-index: 1;
  }

  &:disabled {
    cursor: default;
  }
`

export const Piece = styled.span<{ $white: boolean }>`
  position: relative;
  font-size: 9.6cqw;
  line-height: 1;
  color: ${({ $white }) => ($white ? '#fff' : '#1b1b1f')};
  text-shadow: ${({ $white }) => ($white ? '0 0 2px #1b1b1f, 0 0 2px #1b1b1f' : '0 0 2px #fff, 0 0 2px #fff')};
  user-select: none;
`

// куда можно пойти: точка на пустой клетке, кольцо на клетке с фигурой соперника
export const Dot = styled.span<{ $capture: boolean }>`
  position: absolute;
  width: ${({ $capture }) => ($capture ? '90%' : '30%')};
  height: ${({ $capture }) => ($capture ? '90%' : '30%')};
  border-radius: 50%;
  background: ${({ $capture }) => ($capture ? 'transparent' : 'rgb(0 0 0 / 0.3)')};
  border: ${({ $capture }) => ($capture ? '3px solid rgb(0 0 0 / 0.3)' : '0')};
  pointer-events: none;
`

// выбор фигуры при превращении пешки: затемнение поверх доски и четыре кнопки
export const PromoOverlay = styled.div`
  position: absolute;
  inset: 0;
  z-index: 3;
  display: grid;
  place-items: center;
  border-radius: 0.4rem;
  background: rgb(0 0 0 / 0.55);
`

export const PromoChoices = styled.div`
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0.4rem;
  width: min(86%, 22rem);
  padding: 0.6rem;
  border-radius: 1rem;
  background: var(--surface);
`

export const PromoButton = styled.button`
  display: grid;
  place-items: center;
  aspect-ratio: 1;
  border: 1px solid var(--card-border, var(--border));
  border-radius: 0.8rem;
  background: #eadfc8;
  cursor: pointer;

  &:focus-visible {
    outline: 3px solid var(--accent);
    outline-offset: 2px;
  }

  span {
    font-size: 11cqw;
  }
`
