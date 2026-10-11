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

export const Links = styled.div`
  display: flex;
  gap: 1rem;
`

// подзаголовок группы внутри блока («Без срока»)
export const SubTitle = styled.h3`
  margin: 0.25rem 0 0;
  color: var(--muted);
  font-size: 0.9rem;
  font-weight: 600;
`

export const List = styled.ul`
  display: grid;
  gap: 0.5rem;
  margin: 0;
  padding: 0;
`
