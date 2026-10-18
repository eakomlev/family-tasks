import styled from 'styled-components/native'

// Карточка: белая с мягкой тенью в светлой теме, с тонкой рамкой в тёмной
export const Card = styled.View`
  background-color: ${({ theme }) => theme.colors.surface};
  border-radius: ${({ theme }) => theme.radiusCard}px;
  border-width: 1px;
  border-color: ${({ theme }) => theme.colors.cardBorder};
  padding: 16px;
  shadow-color: #283278;
  shadow-opacity: ${({ theme }) => (theme.dark ? 0 : 0.08)};
  shadow-radius: 12px;
  shadow-offset: 0px 6px;
  elevation: ${({ theme }) => (theme.dark ? 0 : 2)};
`
