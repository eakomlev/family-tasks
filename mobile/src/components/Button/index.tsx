import type { ReactNode } from 'react'
import { Pressable, type PressableProps } from 'react-native'
import styled, { useTheme } from 'styled-components/native'
import { Text } from '../Text'

type Variant = 'primary' | 'lime' | 'secondary' | 'text'

const Base = styled(Pressable)<{ $variant: Variant; $disabled: boolean }>`
  min-height: 52px;
  border-radius: 999px;
  align-items: center;
  justify-content: center;
  padding-horizontal: 22px;
  opacity: ${({ $disabled }) => ($disabled ? 0.5 : 1)};
  background-color: ${({ theme, $variant }) =>
    $variant === 'primary' ? theme.colors.accent : $variant === 'lime' ? theme.colors.lime : $variant === 'secondary' ? theme.colors.surface : 'transparent'};
  border-width: ${({ $variant }) => ($variant === 'secondary' ? 1.5 : 0)}px;
  border-color: ${({ theme }) => theme.colors.border};
`

interface ButtonProps extends Omit<PressableProps, 'children'> {
  variant?: Variant
  children: ReactNode
}

// Кнопки-«таблетки»: основная (акцент), лаймовая (выполнить, подтвердить), вторичная и текстовая
export function Button({ variant = 'secondary', disabled, children, ...rest }: ButtonProps) {
  const { colors } = useTheme()
  const color = variant === 'primary' ? colors.accentText : variant === 'lime' ? colors.onLime : variant === 'text' ? colors.accent : colors.text
  return (
    <Base
      $variant={variant}
      $disabled={!!disabled}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      {...rest}
    >
      <Text $weight="extraBold" $size={16} style={{ color }}>
        {children}
      </Text>
    </Base>
  )
}
