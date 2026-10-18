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
  font-size: ${({ $size = 16 }) => $size}px;
  line-height: ${({ $size = 16 }) => Math.round($size * 1.4)}px;
  color: ${({ theme, $tone = 'default' }) =>
    $tone === 'muted' ? theme.colors.muted : $tone === 'error' ? theme.colors.error : $tone === 'accent' ? theme.colors.accent : theme.colors.text};
`

export const Title = styled(Text).attrs({ $weight: 'black', $size: 26 })`
  line-height: 30px;
`

export const Heading = styled(Text).attrs({ $weight: 'black', $size: 18 })``
