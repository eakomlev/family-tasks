import { Link } from 'react-router-dom'
import styled from 'styled-components'

export const Header = styled.div`
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 1rem;
`

export const EditLink = styled(Link)`
  color: var(--accent);
  font-size: 0.9rem;
  text-decoration: none;

  &:hover {
    text-decoration: underline;
  }
`
