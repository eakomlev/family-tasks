import { Link } from 'react-router-dom'
import styled from 'styled-components'

export const Hero = styled.section`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  padding-top: 1rem;
  text-align: center;
`

export const Badge = styled.span`
  padding: 0.2rem 0.7rem;
  border: 1px solid var(--card-border);
  border-radius: 999px;
  background: var(--surface);
  box-shadow: var(--card-shadow);
  color: var(--muted);
  font-size: 0.85rem;
`

// круглая кнопка-значок «Написать»: переход в личный чат с этим человеком
export const ChatLink = styled(Link)`
  display: grid;
  place-items: center;
  width: 3rem;
  height: 3rem;
  margin-top: 0.25rem;
  border-radius: 50%;
  background: var(--accent);
  color: var(--accent-text);

  svg {
    width: 1.5rem;
    height: 1.5rem;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.8;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  &:hover {
    filter: brightness(1.08);
  }

  &:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 3px;
  }
`

// «Написать» и «Играть» рядом
export const Actions = styled.div`
  display: flex;
  gap: 0.75rem;
`

// круглая кнопка-значок «Играть»: список игр с этим человеком
export const PlayLink = styled(Link)`
  display: grid;
  place-items: center;
  width: 3rem;
  height: 3rem;
  margin-top: 0.25rem;
  border-radius: 50%;
  background: var(--lime);
  color: var(--on-lime);

  svg {
    width: 1.6rem;
    height: 1.6rem;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.8;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  &:hover {
    filter: brightness(1.05);
  }

  &:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 3px;
  }
`
