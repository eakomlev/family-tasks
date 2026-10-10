import styled from 'styled-components'

export const Header = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  /* справа вверху лежит значок профиля */
  padding-right: 3rem;
`

export const Filters = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
`

export const List = styled.ul`
  display: grid;
  gap: 0.5rem;
  margin: 0;
  padding: 0;
`

export const SectionTitle = styled.h2`
  margin: 0.5rem 0 0;
`
