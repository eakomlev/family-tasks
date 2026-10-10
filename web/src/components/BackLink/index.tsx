import { Link } from 'react-router-dom'
import styled from 'styled-components'

export const BackLink = styled(Link)`
  align-self: flex-start;
  color: var(--accent);
  text-decoration: none;

  &:hover {
    text-decoration: underline;
  }
`
