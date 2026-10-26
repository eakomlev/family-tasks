import styled from 'styled-components'

// контейнер задаёт размер значка дамки (cqw: доля ширины доски)
export const Frame = styled.div`
  width: 100%;
  max-width: 28rem;
  margin: 0 auto;
  container-type: inline-size;
`

export const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(8, minmax(0, 1fr));
  grid-template-rows: repeat(8, minmax(0, 1fr));
  aspect-ratio: 1;
  overflow: hidden;
  border-radius: 0.4rem;
`

export const Cell = styled.button<{ $dark: boolean; $mark?: 'last' | 'selected' }>`
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
    background: ${({ $mark }) => ($mark === 'selected' ? 'rgb(75 59 255 / 0.45)' : $mark === 'last' ? 'rgb(255 214 10 / 0.55)' : 'transparent')};
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

// подпись линии в углу клетки, как на chess.com: номер ряда слева сверху у левого края, буква вертикали справа снизу у нижнего;
// цвет контрастный к клетке (тёмная подпись на светлой клетке и наоборот)
export const Coord = styled.span<{ $kind: 'rank' | 'file'; $onDark: boolean }>`
  position: absolute;
  ${({ $kind }) => ($kind === 'rank' ? 'top: 4%; left: 6%;' : 'bottom: 2%; right: 6%;')}
  font-size: 3cqw;
  font-weight: 800;
  line-height: 1;
  color: ${({ $onDark }) => ($onDark ? '#eadfc8' : '#a9835a')};
  /* над фигурой и подсветкой, чтобы шашка у края не закрывала подпись */
  z-index: 2;
  pointer-events: none;
  user-select: none;
`

// шашка: круг с ободком; та, которой можно ходить, чуть приподнята
export const Man = styled.span<{ $white: boolean; $movable: boolean }>`
  position: relative;
  display: grid;
  place-items: center;
  width: 78%;
  height: 78%;
  border-radius: 50%;
  background: ${({ $white }) => ($white ? 'radial-gradient(circle at 35% 30%, #fffdf6, #e8dcc0)' : 'radial-gradient(circle at 35% 30%, #4a4a52, #1b1b1f)')};
  border: 2px solid ${({ $white }) => ($white ? '#b9a785' : '#000')};
  box-shadow: ${({ $movable }) => ($movable ? '0 0 0 3px rgb(75 59 255 / 0.5), 0 2px 4px rgb(0 0 0 / 0.4)' : '0 2px 3px rgb(0 0 0 / 0.35)')};
  color: ${({ $white }) => ($white ? '#8a6d2f' : '#f2b94b')};
  font-size: 7cqw;
  line-height: 1;
  user-select: none;
`

// куда можно пойти: точка на пустой клетке
export const Mark = styled.span`
  position: absolute;
  width: 30%;
  height: 30%;
  border-radius: 50%;
  background: rgb(0 0 0 / 0.3);
  pointer-events: none;
`
