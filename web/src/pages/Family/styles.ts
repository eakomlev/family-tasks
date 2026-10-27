import { Link } from 'react-router-dom'
import styled from 'styled-components'

export const Head = styled.div`
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 1rem;

  h1 {
    margin: 0;
  }
`

export const EditLink = styled(Link)`
  color: var(--accent);
  text-decoration: none;
  font-weight: 600;

  &:hover {
    text-decoration: underline;
  }

  &:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
    border-radius: 0.3rem;
  }
`

export const Members = styled.ul`
  display: grid;
  gap: 0.5rem;
  margin: 0;
  padding: 0;
  list-style: none;
`
