import { Link } from 'react-router-dom'
import styled from 'styled-components'

export const Section = styled.div`
  display: grid;
  gap: 0.25rem;
  margin-top: 0.15rem;
  padding-top: 0.5rem;
  border-top: 1px dashed var(--border);
`

export const Heading = styled.p`
  display: flex;
  justify-content: space-between;
  gap: 0.75rem;
  margin: 0;
  color: var(--muted);
  font-size: 0.85rem;
`

export const List = styled.ul`
  display: grid;
  gap: 0.1rem;
  margin: 0;
  padding: 0;
  list-style: none;
`

export const Row = styled(Link)<{ $done: boolean }>`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.25rem 0.3rem;
  margin: 0 -0.3rem;
  border-radius: 0.5rem;
  color: ${({ $done }) => ($done ? 'var(--muted)' : 'inherit')};
  text-decoration: none;

  &:hover {
    background: color-mix(in srgb, var(--accent) 10%, transparent);
  }

  &:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 1px;
  }
`

export const Title = styled.span<{ $done: boolean }>`
  flex: 1;
  min-width: 0;
  font-size: 0.95rem;
  text-decoration: ${({ $done }) => ($done ? 'line-through' : 'none')};
  overflow-wrap: anywhere;
`

export const Time = styled.span`
  flex: none;
  color: var(--muted);
  font-size: 0.8rem;
`

// маленький значок состояния, как у карточек заданий: лаймовая галочка у выполненного,
// фиолетовый кружок у ждущего проверки, пустой у остальных
export const Mark = styled.span<{ $done: boolean; $pending?: boolean }>`
  flex: none;
  width: 1.1rem;
  height: 1.1rem;
  display: grid;
  place-items: center;
  border: 2px solid ${({ $done, $pending }) => ($done ? 'var(--lime)' : $pending ? 'var(--review-text)' : 'var(--check-border)')};
  border-radius: 50%;
  background: ${({ $done, $pending }) => ($done ? 'var(--lime)' : $pending ? 'var(--review-bg)' : 'transparent')};
  color: ${({ $done, $pending }) => ($done ? 'var(--on-lime)' : $pending ? 'var(--review-text)' : 'transparent')};
  font-size: 0.65rem;
  font-weight: 900;
  line-height: 1;
`

export const Hidden = styled.span`
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
`
