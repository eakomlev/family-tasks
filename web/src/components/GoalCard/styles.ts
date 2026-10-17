import { Link } from 'react-router-dom'
import styled from 'styled-components'

export const Card = styled(Link)`
  display: flex;
  align-items: center;
  gap: 0.8rem;
  padding: 0.6rem;
  border: 1px solid var(--card-border);
  border-radius: var(--radius-card);
  background: var(--surface);
  box-shadow: var(--card-shadow);
  color: inherit;
  text-decoration: none;

  &:hover {
    border-color: var(--accent);
  }

  &:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
`

export const Body = styled.div`
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;

  strong {
    overflow-wrap: anywhere;
  }
`

export const Price = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  color: var(--muted);
  font-size: 0.9rem;
  font-variant-numeric: tabular-nums;

  svg {
    width: 1.1rem;
    height: 1.1rem;
  }
`

// сколько накоплено от цены
export const Progress = styled.span<{ $ratio: number }>`
  display: block;
  height: 0.5rem;
  border-radius: 999px;
  background: var(--track);
  overflow: hidden;

  &::after {
    content: '';
    display: block;
    width: ${({ $ratio }) => Math.round(Math.min(1, Math.max(0, $ratio)) * 100)}%;
    height: 100%;
    border-radius: inherit;
    background: var(--coin);
  }
`

export const Chevron = styled.span`
  flex: none;
  color: var(--muted);
  font-size: 1.4rem;
  line-height: 1;
`

export const Frame = styled.div<{ $large?: boolean }>`
  position: relative;
  flex: none;
  width: ${({ $large }) => ($large ? '100%' : '4.5rem')};
  aspect-ratio: ${({ $large }) => ($large ? '4 / 3' : '1')};
  max-height: ${({ $large }) => ($large ? '18rem' : 'none')};
  border-radius: ${({ $large }) => ($large ? '1rem' : '0.7rem')};
  overflow: hidden;
  background: color-mix(in srgb, var(--accent) 14%, var(--surface));
  color: var(--accent);

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  /* заглушка без картинки: значок подарка по центру */
  svg {
    position: absolute;
    inset: 0;
    margin: auto;
    width: 48%;
    height: 48%;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.6;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
`

// бейдж «Куплено» на картинке
export const Bought = styled.span<{ $large?: boolean }>`
  position: absolute;
  inset: auto 0 0 0;
  padding: ${({ $large }) => ($large ? '0.4rem' : '0.1rem')};
  background: var(--accent);
  color: var(--accent-text);
  font-size: ${({ $large }) => ($large ? '0.9rem' : '0.65rem')};
  font-weight: 700;
  text-align: center;
`
