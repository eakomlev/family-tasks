import styled from 'styled-components'

// переключатель способа входа: две «таблетки» в ряд
export const Kinds = styled.div`
  display: flex;
  gap: 0.5rem;
`

export const KindTab = styled.button<{ $active: boolean }>`
  flex: 1;
  padding: 0.55rem 0.9rem;
  border: 1px solid ${({ $active }) => ($active ? 'var(--accent)' : 'var(--card-border)')};
  border-radius: 999px;
  background: ${({ $active }) => ($active ? 'var(--accent)' : 'var(--surface)')};
  color: ${({ $active }) => ($active ? 'var(--accent-text)' : 'var(--text)')};
  font: inherit;
  font-weight: 800;
  cursor: pointer;

  &:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
`
