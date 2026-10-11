import styled from 'styled-components'

export const Label = styled.label`
  display: inline-flex;
  align-items: center;
  gap: 0.6rem;
  font-weight: 600;
  cursor: pointer;
`

export const Box = styled.input`
  width: 1.25rem;
  height: 1.25rem;
  margin: 0;
  accent-color: var(--accent);
  cursor: pointer;

  &:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
`
