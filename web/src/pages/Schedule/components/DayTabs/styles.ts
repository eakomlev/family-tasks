import styled from 'styled-components'

export const Tabs = styled.div`
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 0.35rem;
`

export const Tab = styled.button<{ $active: boolean }>`
  position: relative;
  padding: 0.6rem 0;
  border: 2px solid ${({ $active }) => ($active ? 'var(--accent)' : 'var(--border)')};
  border-radius: 0.7rem;
  background: ${({ $active }) => ($active ? 'var(--accent)' : 'var(--surface)')};
  color: ${({ $active }) => ($active ? 'var(--accent-text)' : 'var(--text)')};
  font: inherit;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;

  &:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
`

export const Count = styled.span`
  display: block;
  margin-top: 0.1rem;
  font-size: 0.7rem;
  font-weight: 400;
  opacity: 0.8;
`
