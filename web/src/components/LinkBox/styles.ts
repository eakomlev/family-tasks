import styled from 'styled-components'

export const Box = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
`

// ссылка в одну строку, справа значок «копировать»
export const LinkRow = styled.div`
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.25rem 0.25rem 0.25rem 0.75rem;
  border: 1.5px solid var(--border);
  border-radius: 0.9rem;
  background: var(--bg);

  code {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    font-size: 0.9rem;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
`

export const CopyButton = styled.button<{ $done: boolean }>`
  flex: none;
  display: grid;
  place-items: center;
  width: 2.4rem;
  height: 2.4rem;
  border: 0;
  border-radius: 0.7rem;
  background: transparent;
  color: ${({ $done }) => ($done ? 'var(--success)' : 'var(--accent)')};
  cursor: pointer;

  svg {
    width: 1.35rem;
    height: 1.35rem;
    fill: none;
    stroke: currentColor;
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  &:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 1px;
  }
`

export const Expiry = styled.small`
  padding: 0 0.25rem;
  color: var(--muted);
`
