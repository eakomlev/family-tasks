import styled from 'styled-components'

export const Row = styled.div`
  display: grid;
  gap: 0.8rem;

  label {
    font-weight: 800;
  }

  input[type='range'] {
    width: 100%;
    accent-color: var(--accent);
  }
`

export const Preview = styled.p`
  margin: 0;
  padding: 0.8rem 1rem;
  border: 1px solid var(--border);
  border-radius: var(--radius-card, 1rem);
  background: var(--surface);
`
