import type { ReactNode } from 'react'
import { Platform, Pressable, Switch as NativeSwitch, View } from 'react-native'
import { useTheme } from 'styled-components/native'
import { Text } from '../Text'

// Переключатель-«слайдер» с подписью в карточке: нажатие на строку тоже переключает. Цвета из темы.
export function Switch({
  checked,
  onChange,
  disabled,
  hint,
  children,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
  hint?: string
  children: ReactNode
}) {
  const { colors, radiusCard } = useTheme()
  return (
    <Pressable
      onPress={() => !disabled && onChange(!checked)}
      accessibilityRole="switch"
      accessibilityState={{ checked, disabled: !!disabled }}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: radiusCard,
        borderWidth: 1,
        borderColor: colors.cardBorder,
        backgroundColor: colors.surface,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text $weight="extraBold">{children}</Text>
        {hint && (
          <Text $size={13} $tone="muted">
            {hint}
          </Text>
        )}
      </View>
      <NativeSwitch
        value={checked}
        onValueChange={onChange}
        disabled={disabled}
        trackColor={{ false: colors.border, true: colors.accent }}
        thumbColor={Platform.OS === 'android' ? '#ffffff' : undefined}
        ios_backgroundColor={colors.border}
      />
    </Pressable>
  )
}
