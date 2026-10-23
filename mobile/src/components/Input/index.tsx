import styled from 'styled-components/native'
import { FONT_FAMILY } from '@/theme/fonts'

// Поле ввода: цвета из темы, шрифт тот же, что у всего текста
export const Input = styled.TextInput.attrs(({ theme }) => ({
  placeholderTextColor: theme.colors.muted,
}))`
  min-height: 52px;
  border-radius: 16px;
  border-width: 1.5px;
  border-color: ${({ theme }) => theme.colors.border};
  background-color: ${({ theme }) => theme.colors.surface};
  color: ${({ theme }) => theme.colors.text};
  padding-horizontal: 16px;
  font-family: ${FONT_FAMILY.regular};
  font-size: ${({ theme }) => 16 * theme.fontScale}px;
`
