import styled from 'styled-components'

// вертикальная колонка с отступами; через as="form" / as="section" получаются форма и секция
export const Stack = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1rem;
`
