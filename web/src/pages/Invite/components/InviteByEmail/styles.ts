import styled from 'styled-components'

export const AddRow = styled.div`
  display: flex;
  gap: 0.5rem;

  input {
    flex: 1;
    min-width: 0;
  }
`

export const List = styled.ul`
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  margin: 0;
  padding: 0;
  list-style: none;
`

export const Row = styled.li`
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.6rem 0.75rem;
  border: 1px solid var(--border);
  border-radius: 0.8rem;
  background: var(--surface);
`

export const Who = styled.span`
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;

  strong,
  small {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  small {
    color: var(--muted);
  }
`

export const Status = styled.span<{ $tone: 'ok' | 'error' | 'muted' }>`
  flex: none;
  max-width: 45%;
  font-size: 0.8rem;
  text-align: right;
  color: ${({ $tone }) => ($tone === 'ok' ? 'var(--success)' : $tone === 'error' ? 'var(--error)' : 'var(--muted)')};
`

export const Remove = styled.button`
  flex: none;
  width: 2rem;
  height: 2rem;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: var(--muted);
  font-size: 1.2rem;
  cursor: pointer;

  &:hover {
    background: var(--border);
  }
`
