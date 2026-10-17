import styled from 'styled-components'

export const Section = styled.section`
  display: grid;
  gap: 0.6rem;

  h2 {
    margin: 0.5rem 0 0;
    font-size: 1rem;
    color: var(--muted);
    font-weight: 600;
  }
`

export const Cards = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.6rem;
`

export const Card = styled.div<{ $small?: boolean }>`
  display: grid;
  gap: 0.2rem;
  padding: 0.8rem 0.9rem;
  border: 1px solid var(--card-border);
  border-radius: var(--radius-card);
  background: var(--surface);
  box-shadow: var(--card-shadow);

  span {
    color: var(--muted);
    font-size: 0.85rem;
  }

  strong {
    font-size: ${({ $small }) => ($small ? '1.05rem' : '1.6rem')};
    font-variant-numeric: tabular-nums;
    line-height: 1.2;
  }
`
