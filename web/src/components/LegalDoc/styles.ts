import styled from 'styled-components'

// документ на карточке: читаемая ширина, заголовки разделов, списки
export const Doc = styled.article`
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 1.25rem 1.1rem;
  border: 1px solid var(--card-border);
  border-radius: var(--radius-card);
  background: var(--surface);
  box-shadow: var(--card-shadow);
  line-height: 1.5;

  h1 {
    margin: 0;
    font-size: 1.5rem;
  }

  h2 {
    margin: 0.75rem 0 0;
    font-size: 1.1rem;
  }

  p,
  ul {
    margin: 0;
  }

  ul {
    padding-left: 1.2rem;
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
  }

  .date {
    color: var(--muted);
    font-size: 0.9rem;
  }

  a {
    color: var(--accent);
  }
`
