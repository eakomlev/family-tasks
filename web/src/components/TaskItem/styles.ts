import { Link } from 'react-router-dom'
import styled, { css } from 'styled-components'
import type { TaskState } from './types'

export const Row = styled.li`
  list-style: none;
`

// вся карточка — ссылка на страницу задания
export const Card = styled(Link)`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 0.9rem;
  border: 1px solid var(--card-border);
  border-radius: var(--radius-card);
  background: var(--surface);
  box-shadow: var(--card-shadow);
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

// Карточка с кнопками проверки: та же рамка, но ссылкой остаётся только верхняя часть, а кнопки лежат под ней
// (кнопка внутри ссылки недопустима).
export const Shell = styled.div`
  border: 1px solid var(--card-border);
  border-radius: var(--radius-card);
  background: var(--surface);
  box-shadow: var(--card-shadow);
  overflow: hidden;
`

export const Inner = styled(Link)`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 0.9rem;
  color: inherit;
  text-decoration: none;

  &:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: -2px;
  }
`

export const Actions = styled.div`
  display: flex;
  gap: 0.5rem;
  padding: 0 0.9rem 0.7rem;

  button {
    flex: 1;
    padding: 0.55rem 0.8rem;
    border: 1px solid var(--border);
    border-radius: 999px;
    background: var(--surface);
    color: var(--text);
    font: inherit;
    font-weight: 800;
    cursor: pointer;
  }

  /* подтверждение с наградой: лаймовая кнопка действия */
  button[data-primary] {
    flex: 1.6;
    border-color: var(--lime);
    background: var(--lime);
    color: var(--on-lime);
    font-weight: 900;
  }

  button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  button:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
`

// круглая «галочка», как в игре: пустой круг у открытого, лаймовый у выполненного,
// песочные часы у ждущего проверки, часы у просроченного
export const Badge = styled.span<{ $state: TaskState }>`
  flex: none;
  width: 2rem;
  height: 2rem;
  display: grid;
  place-items: center;
  border-radius: 50%;

  svg {
    width: 1.2rem;
    height: 1.2rem;
    fill: none;
    stroke: currentColor;
    stroke-width: 2.2;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  ${({ $state }) =>
    $state === 'done'
      ? css`
          background: var(--lime);
          color: var(--on-lime);
        `
      : $state === 'pending'
        ? css`
            background: var(--review-bg);
            color: var(--review-text);
          `
      : $state === 'late'
        ? css`
            background: color-mix(in srgb, var(--error) 16%, transparent);
            color: var(--error);
          `
        : css`
            border: 2.5px solid var(--check-border);

            svg {
              display: none;
            }
          `}
`

// фото исполнителя слева; значок состояния сидит на его правом нижнем углу
export const Lead = styled.span`
  position: relative;
  flex: none;
  display: grid;
`

export const Mark = styled.span<{ $state: TaskState }>`
  position: absolute;
  right: -0.25rem;
  bottom: -0.25rem;
  width: 1.2rem;
  height: 1.2rem;
  display: grid;
  place-items: center;
  border: 2px solid var(--surface);
  border-radius: 50%;
  box-sizing: content-box;

  svg {
    width: 0.8rem;
    height: 0.8rem;
    fill: none;
    stroke: currentColor;
    stroke-width: 2.6;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  ${({ $state }) =>
    $state === 'done'
      ? css`
          background: var(--lime);
          color: var(--on-lime);
        `
      : $state === 'pending'
        ? css`
            background: var(--review-bg);
            color: var(--review-text);
          `
        : css`
            background: color-mix(in srgb, var(--error) 22%, var(--surface));
            color: var(--error);
          `}
`

// плашка награды справа: золотая, у выполненного приглушённая
export const Reward = styled.span<{ $done: boolean }>`
  flex: none;
  align-self: center;
  padding: 0.2rem 0.65rem;
  border-radius: 999px;
  background: var(--coin-bg);
  color: var(--coin-text);
  font-size: 0.85rem;
  font-weight: 900;
  font-variant-numeric: tabular-nums;
  opacity: ${({ $done }) => ($done ? 0.6 : 1)};
`

export const Body = styled.div`
  flex: 1;
  min-width: 0;
  align-self: stretch;
  display: flex;
  flex-direction: column;
  /* без второй строки (срока и т. п.) название стоит по центру напротив значка */
  justify-content: center;
  gap: 0.15rem;
`

export const Title = styled.span<{ $done: boolean }>`
  font-weight: 800;
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
  font-weight: 700;
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
