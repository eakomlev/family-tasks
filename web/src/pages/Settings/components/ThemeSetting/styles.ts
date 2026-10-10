import styled from 'styled-components'

export const Options = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.5rem;
`

export const Option = styled.button<{ $active: boolean }>`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.3rem;
  padding: 0.75rem 0.25rem;
  border: 2px solid ${({ $active }) => ($active ? 'var(--accent)' : 'var(--border)')};
  border-radius: 0.8rem;
  background: var(--surface);
  color: var(--text);
  font: inherit;
  font-size: 0.85rem;
  cursor: pointer;

  &:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
`

export const Icon = styled.span`
  font-size: 1.5rem;
  line-height: 1;
`
