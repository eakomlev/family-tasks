import styled from 'styled-components'

export const Details = styled.dl`
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 0.4rem 1rem;
  margin: 0;

  dt {
    color: var(--muted);
  }

  dd {
    margin: 0;
    font-weight: 600;
  }
`

export const People = styled.ul`
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin: 0;
  padding: 0;
  list-style: none;
`

export const Person = styled.li`
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.25rem 0.8rem 0.25rem 0.3rem;
  border: 1px solid var(--card-border);
  border-radius: 999px;
  background: var(--surface);
  box-shadow: var(--card-shadow);
`
