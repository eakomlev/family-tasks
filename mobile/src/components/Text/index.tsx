import styled from 'styled-components/native'
import { FONT_FAMILY, type FontWeight } from '@/theme/fonts'

interface TextProps {
  $weight?: FontWeight
  $size?: number
  $tone?: 'default' | 'muted' | 'error' | 'accent'
}

// Базовый текст приложения: Nunito, цвет из темы. Заголовки и числа жирные ($weight="black"), основной текст обычный.
export const Text = styled.Text<TextProps>`
  font-family: ${({ $weight = 'regular' }) => FONT_FAMILY[$weight]};
  font-size: ${({ $size = 16, theme }) => $size * theme.fontScale}px;
  line-height: ${({ $size = 16, theme }) => Math.round($size * theme.fontScale * 1.4)}px;
  color: ${({ theme, $tone = 'default' }) =>
    $tone === 'muted' ? theme.colors.muted : $tone === 'error' ? theme.colors.error : $tone === 'accent' ? theme.colors.accent : theme.colors.text};
`

export const Title = styled(Text).attrs({ $weight: 'black', $size: 26 })`
  line-height: 30px;
`

// Место справа в строке заголовка под угол с монетами и значком профиля (рисуется поверх экранов вошедшего)
export const TOP_RIGHT_RESERVE = 150

// Заголовок страницы: стоит на одной линии со значком профиля, поэтому справа оставляет ему место
export const PageTitle = styled(Title)`
  padding-right: ${TOP_RIGHT_RESERVE}px;
`

export const Heading = styled(Text).attrs({ $weight: 'black', $size: 18 })``
