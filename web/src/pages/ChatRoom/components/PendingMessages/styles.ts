import styled from 'styled-components'

export const Row = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.2rem;
  margin-top: 0.35rem;
`

export const Bubble = styled.div<{ $failed: boolean }>`
  display: flex;
  flex-direction: column;
  max-width: 82%;
  padding: 0.3rem 0.6rem;
  border-radius: 1rem;
  border-bottom-right-radius: 0.3rem;
  background: var(--accent);
  color: var(--accent-text);
  opacity: ${({ $failed }) => ($failed ? 1 : 0.7)};
  outline: ${({ $failed }) => ($failed ? '2px solid var(--danger, #e5484d)' : 'none')};
  white-space: pre-wrap;
  overflow-wrap: anywhere;
`

export const State = styled.small`
  align-self: flex-end;
  font-size: 0.7rem;
  opacity: 0.85;
`

export const Actions = styled.div`
  display: flex;
  gap: 0.8rem;

  button {
    border: 0;
    background: none;
    padding: 0;
    color: var(--accent);
    font: inherit;
    font-size: 0.85rem;
    font-weight: 700;
    cursor: pointer;
  }
`
