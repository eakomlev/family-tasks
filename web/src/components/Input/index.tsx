import styled from 'styled-components'

export const Input = styled.input`
  padding: 0.8rem 1rem;
  border: 1px solid var(--border);
  border-radius: 0.8rem;
  background: var(--surface);
  color: var(--text);
  font: inherit;
  font-weight: 400;

  &:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
`
