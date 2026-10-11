import styled from 'styled-components'

export const Box = styled.div`
  max-width: 28rem;
  margin: 0 auto;
  padding: 3rem 1rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;

  h1,
  p {
    margin: 0;
  }

  button {
    padding: 0.85rem 1.25rem;
    border: 0;
    border-radius: 0.8rem;
    background: var(--accent);
    color: var(--accent-text);
    font: inherit;
    font-weight: 600;
    cursor: pointer;
  }

  pre {
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    color: var(--muted);
    font-size: 0.8rem;
  }
`
