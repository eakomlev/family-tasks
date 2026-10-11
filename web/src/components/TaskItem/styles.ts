import { Link } from 'react-router-dom'
import styled, { css } from 'styled-components'
import type { TaskState } from './types'

export const Row = styled.li`
  list-style: none;
`

// вся карточка — ссылка на страницу задания
export const Card = styled(Link)`
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  padding: 0.7rem 0.9rem;
  border: 1px solid var(--border);
  border-radius: 0.8rem;
  background: var(--surface);
  color: inherit;
  text-decoration: none;

  &:hover {
    border-color: var(--accent);
  }

  &:active {
    transform: scale(0.99);
  }

  &:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
`

// значок состояния: что сделано, что ещё нет, что просрочено
export const Badge = styled.span<{ $state: TaskState }>`
  flex: none;
  width: 2.25rem;
  height: 2.25rem;
  display: grid;
  place-items: center;
  border-radius: 0.7rem;

  svg {
    width: 1.35rem;
    height: 1.35rem;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.8;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  ${({ $state }) =>
    $state === 'done'
      ? css`
          background: var(--accent);
          color: var(--accent-text);
        `
      : $state === 'late'
        ? css`
            background: color-mix(in srgb, var(--error) 16%, transparent);
            color: var(--error);
          `
        : css`
            background: color-mix(in srgb, var(--accent) 14%, transparent);
            color: var(--accent);
          `}
`

export const Body = styled.div`
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
`

export const Title = styled.span<{ $done: boolean }>`
  color: ${({ $done }) => ($done ? 'var(--muted)' : 'var(--text)')};
  text-decoration: ${({ $done }) => ($done ? 'line-through' : 'none')};
  overflow-wrap: anywhere;
`

export const Meta = styled.span<{ $late?: boolean }>`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.2rem 0.6rem;
  color: ${({ $late }) => ($late ? 'var(--error)' : 'var(--muted)')};
  font-size: 0.85rem;
`

export const Who = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
`

export const Chevron = styled.span`
  flex: none;
  align-self: center;
  color: var(--muted);
  font-size: 1.4rem;
  line-height: 1;
`

// для скринридеров: состояние, которое снаружи видно только по значку
export const Hidden = styled.span`
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
`
