import styled from 'styled-components'

export const Row = styled.li`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.6rem 1rem;
  border: 1px solid var(--border);
  border-radius: 0.8rem;
  background: var(--surface);
`

export const Name = styled.span`
  flex: 1;
  min-width: 0;
  overflow-wrap: anywhere;
`
