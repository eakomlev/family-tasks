import { Link } from 'react-router-dom'
import styled from 'styled-components'

export const Row = styled.li`
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  padding: 0.7rem 0.9rem;
  border: 1px solid var(--border);
  border-radius: 0.8rem;
  background: var(--surface);
  list-style: none;
`

// круглый флажок выполнения
export const Check = styled.button<{ $done: boolean }>`
  flex: none;
  width: 1.6rem;
  height: 1.6rem;
  margin-top: 0.1rem;
  display: grid;
  place-items: center;
  padding: 0;
  border: 2px solid ${({ $done }) => ($done ? 'var(--accent)' : 'var(--border)')};
  border-radius: 50%;
  background: ${({ $done }) => ($done ? 'var(--accent)' : 'transparent')};
  color: var(--accent-text);
  font-size: 0.9rem;
  line-height: 1;
  cursor: pointer;

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
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
  gap: 0.15rem;
`

export const Title = styled(Link)<{ $done: boolean }>`
  color: ${({ $done }) => ($done ? 'var(--muted)' : 'var(--text)')};
  text-decoration: ${({ $done }) => ($done ? 'line-through' : 'none')};
  overflow-wrap: anywhere;

  &:hover {
    text-decoration: underline;
  }
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
