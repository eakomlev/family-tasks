import styled from 'styled-components'
import type { ZoneTone } from './types'

export const Bar = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-width: 0;
  /* между зонами отступ больше, чем между карточками внутри */
  padding-top: 0.5rem;
`

export const Chip = styled.span<{ $tone: ZoneTone }>`
  flex: none;
  display: grid;
  place-items: center;
  width: 1.9rem;
  height: 1.9rem;
  border-radius: 0.65rem;
  background: var(--zone-${({ $tone }) => $tone}-bg);
  color: var(--zone-${({ $tone }) => $tone}-fg);

  svg {
    width: 1.2rem;
    height: 1.2rem;
    fill: none;
    stroke: currentColor;
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
`

export const Title = styled.h2<{ $tone: ZoneTone }>`
  margin: 0;
  font-size: 1.05rem;
  color: var(--zone-${({ $tone }) => $tone}-fg);
`

export const Count = styled.span<{ $tone: ZoneTone }>`
  min-width: 1.4rem;
  padding: 0 0.4rem;
  border-radius: 999px;
  background: var(--zone-${({ $tone }) => $tone}-line);
  color: #fff;
  font-size: 0.8rem;
  font-weight: 900;
  line-height: 1.4rem;
  text-align: center;
`

export const Line = styled.span<{ $tone: ZoneTone }>`
  flex: 1;
  min-width: 0.5rem;
  height: 2px;
  border-radius: 1px;
  background: var(--zone-${({ $tone }) => $tone}-line);
  opacity: 0.45;
`
