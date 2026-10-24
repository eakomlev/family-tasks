import styled from 'styled-components'

// секция страницы в карточке
export const Card = styled.section`
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 1rem;
  border: 1px solid var(--card-border);
  border-radius: var(--radius-card);
  background: var(--surface);
  box-shadow: var(--card-shadow);

  h2,
  p {
    margin: 0;
  }

  p {
    color: var(--muted);
  }
`
