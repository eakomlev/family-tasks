import type { ReactNode } from 'react'
import styled from 'styled-components/native'
import { Text } from '../Text'

const Wrap = styled.View`
  gap: 6px;
`

// Подпись над полем ввода и необязательная подсказка под ним
export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <Wrap>
      <Text $weight="extraBold" $size={14} $tone="muted">
        {label}
      </Text>
      {children}
      {hint && (
        <Text $size={13} $tone="muted">
          {hint}
        </Text>
      )}
    </Wrap>
  )
}
