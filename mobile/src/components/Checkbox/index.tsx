import type { ReactNode } from 'react'
import { Pressable, View } from 'react-native'
import styled from 'styled-components/native'
import { Text } from '../Text'

const Box = styled.View<{ $checked: boolean }>`
  width: 26px;
  height: 26px;
  border-radius: 8px;
  align-items: center;
  justify-content: center;
  border-width: 2px;
  border-color: ${({ theme, $checked }) => ($checked ? theme.colors.accent : theme.colors.checkBorder)};
  background-color: ${({ theme, $checked }) => ($checked ? theme.colors.accent : 'transparent')};
`

// Флажок с подписью
export function Checkbox({ checked, onChange, children }: { checked: boolean; onChange: (checked: boolean) => void; children: ReactNode }) {
  return (
    <Pressable
      onPress={() => onChange(!checked)}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44 }}
    >
      <Box $checked={checked}>
        {checked && (
          <View>
            <Text $weight="black" $size={16} style={{ color: '#ffffff' }}>
              ✓
            </Text>
          </View>
        )}
      </Box>
      <Text $weight="bold">{children}</Text>
    </Pressable>
  )
}
