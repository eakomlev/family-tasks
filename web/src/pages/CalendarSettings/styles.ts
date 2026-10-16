import styled from 'styled-components'

export const Group = styled.section`
  display: flex;
  flex-direction: column;
  gap: 0.6rem;

  h2 {
    margin: 0;
    font-size: 1.05rem;
  }
`

export const People = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
`

export const Person = styled.button<{ $active: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.25rem 0.85rem 0.25rem 0.3rem;
  border: 1px solid ${({ $active }) => ($active ? 'var(--accent)' : 'var(--border)')};
  border-radius: 999px;
  background: ${({ $active }) => ($active ? 'color-mix(in srgb, var(--accent) 14%, var(--surface))' : 'var(--surface)')};
  color: ${({ $active }) => ($active ? 'var(--text)' : 'var(--muted)')};
  font: inherit;
  cursor: pointer;
  opacity: ${({ $active }) => ($active ? 1 : 0.7)};

  &:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
`

export const Hint = styled.p`
  margin: 0;
  color: var(--muted);
  font-size: 0.85rem;
`
