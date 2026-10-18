import styled from 'styled-components/native'

// Колонка с равными промежутками (аналог `Stack` в вебе)
export const Stack = styled.View<{ $gap?: number }>`
  gap: ${({ $gap = 12 }) => $gap}px;
`
