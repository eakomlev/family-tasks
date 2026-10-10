import styled from 'styled-components'

export const Input = styled.input`
  /* без этого поле не сжимается в гибких и сеточных контейнерах и раздувает страницу */
  min-width: 0;
  padding: 0.8rem 1rem;
  border: 1px solid var(--border);
  border-radius: 0.8rem;
  background: var(--surface);
  color: var(--text);
  font: inherit;
  font-weight: 400;

  &:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }

  &:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
`
