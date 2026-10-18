import type { ReactNode } from 'react'
import styled from 'styled-components/native'
import { Text } from '../Text'

const Box = styled.View<{ $tone: 'error' | 'muted' | 'warning' }>`
  border-radius: 14px;
  padding: 10px 14px;
  background-color: ${({ theme, $tone }) => ($tone === 'muted' ? 'transparent' : theme.colors.warningBg)};
`

// Короткое сообщение: ошибка, предупреждение или приглушённая подсказка
export function Notice({ tone = 'muted', children }: { tone?: 'error' | 'muted' | 'warning'; children: ReactNode }) {
  return (
    <Box $tone={tone} accessibilityRole={tone === 'error' ? 'alert' : undefined}>
      <Text $size={14} $tone={tone === 'error' ? 'error' : tone === 'muted' ? 'muted' : 'default'}>
        {children}
      </Text>
    </Box>
  )
}
