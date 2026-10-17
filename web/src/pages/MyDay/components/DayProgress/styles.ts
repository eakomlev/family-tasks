import { Link } from 'react-router-dom'
import styled from 'styled-components'

// яркий фиолетовый блок (в тёмной теме глубокий индиго с рамкой)
export const Card = styled.section`
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  border: 1px solid var(--hero-border);
  border-radius: 1.75rem;
  background: var(--hero-bg);
  box-shadow: var(--hero-shadow);
  color: var(--hero-text);
`

export const Ring = styled.svg`
  flex: none;
  width: 5.4rem;
  height: 5.4rem;

  circle {
    fill: none;
    stroke-width: 12;
  }

  circle[data-track] {
    stroke: var(--hero-track);
  }

  /* дуга от верхней точки по часовой стрелке */
  circle[data-fill] {
    stroke: var(--lime);
    stroke-linecap: round;
    transform: rotate(-90deg);
    transform-origin: center;
    transition: stroke-dasharray 0.5s ease;
  }

  text {
    fill: currentColor;
    font-family: inherit;
    font-size: 20px;
    font-weight: 900;
  }

  @media (prefers-reduced-motion: reduce) {
    circle[data-fill] {
      transition: none;
    }
  }
`

export const Text = styled.div`
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
`

export const Label = styled.span`
  color: var(--hero-muted);
  font-size: 0.8rem;
  font-weight: 800;
`

export const Title = styled.span`
  font-size: 1.2rem;
  font-weight: 900;
  line-height: 1.2;
`

export const GoalLink = styled(Link)`
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  margin-top: 0.15rem;
  color: inherit;
  text-decoration: none;
  -webkit-tap-highlight-color: transparent;

  &:focus-visible {
    outline: 2px solid var(--lime);
    outline-offset: 3px;
    border-radius: 0.5rem;
  }
`

export const Bar = styled.span`
  display: block;
  height: 0.6rem;
  border-radius: 999px;
  background: var(--hero-track);
  overflow: hidden;
`

export const Fill = styled.span`
  display: block;
  height: 100%;
  border-radius: 999px;
  background: var(--coin);
`
