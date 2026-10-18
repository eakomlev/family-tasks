import type { ReactNode } from 'react'
import { Pressable, type PressableProps } from 'react-native'
import styled from 'styled-components/native'
import { Text } from '../Text'

const Pill = styled(Pressable)<{ $active: boolean }>`
  min-height: 40px;
  padding-horizontal: 16px;
  border-radius: 999px;
  align-items: center;
  justify-content: center;
  border-width: 1.5px;
  border-color: ${({ theme, $active }) => ($active ? theme.colors.accent : theme.colors.border)};
  background-color: ${({ theme, $active }) => ($active ? theme.colors.accent : theme.colors.surface)};
`

interface ChipProps extends Omit<PressableProps, 'children'> {
  active?: boolean
  children: ReactNode
}

// Чип-«таблетка» для выбора: фильтры, дни недели, готовые суммы
export function Chip({ active = false, children, ...rest }: ChipProps) {
  return (
    <Pill $active={active} accessibilityRole="button" accessibilityState={{ selected: active }} {...rest}>
      <Text $weight="extraBold" $size={14} style={{ color: active ? '#ffffff' : undefined }}>
        {children}
      </Text>
    </Pill>
  )
}
