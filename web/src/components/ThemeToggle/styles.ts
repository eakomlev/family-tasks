import styled from 'styled-components'

export const Toggle = styled.button`
  position: fixed;
  top: 0.5rem;
  right: 0.5rem;
  z-index: 10;
  width: 2.5rem;
  height: 2.5rem;
  padding: 0;
  border: 1px solid var(--border);
  border-radius: 50%;
  background: var(--surface);
  font-size: 1.1rem;
  line-height: 1;
  cursor: pointer;

  &:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
`
