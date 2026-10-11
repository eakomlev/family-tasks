import styled from 'styled-components'

export const Section = styled.section`
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
`

export const Title = styled.h2`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin: 0;
`

export const Count = styled.span`
  min-width: 1.5rem;
  padding: 0 0.45rem;
  border-radius: 999px;
  background: #d97706;
  color: #fff;
  font-size: 0.85rem;
  line-height: 1.5rem;
  text-align: center;
`

export const List = styled.ul`
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 0.5rem;
  margin: 0;
  padding: 0;
`
