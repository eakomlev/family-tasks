import styled from 'styled-components'

export const Card = styled.li<{ $dragging: boolean }>`
  position: relative;
  z-index: ${({ $dragging }) => ($dragging ? 2 : 'auto')};
  display: grid;
  grid-template-columns: auto auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.5rem 0.6rem;
  padding: 0.75rem;
  border: 1px solid ${({ $dragging }) => ($dragging ? 'var(--accent)' : 'var(--border)')};
  border-radius: 0.8rem;
  background: var(--surface);
  box-shadow: ${({ $dragging }) => ($dragging ? '0 8px 24px rgb(0 0 0 / 0.3)' : 'none')};
  list-style: none;
`

// за неё тянут карточку; touch-action: none нужен, чтобы на телефоне жест не превращался в прокрутку
export const Handle = styled.button`
  width: 1.75rem;
  height: 2.25rem;
  padding: 0;
  border: 0;
  border-radius: 0.5rem;
  background: none;
  color: var(--muted);
  font-size: 1.2rem;
  line-height: 1;
  cursor: grab;
  touch-action: none;

  &:active {
    cursor: grabbing;
  }

  &:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
`

export const Number = styled.span`
  width: 1.75rem;
  height: 1.75rem;
  display: grid;
  place-items: center;
  border-radius: 50%;
  background: var(--bg);
  color: var(--muted);
  font-size: 0.85rem;
  font-weight: 600;
`

export const Times = styled.div`
  grid-column: 1 / -1;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--muted);

  input {
    flex: 1;
    min-width: 0;
  }
`
