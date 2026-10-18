import type { ReactElement, ReactNode } from 'react'
import { KeyboardAvoidingView, ScrollView, View, type RefreshControlProps } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import styled from 'styled-components/native'

const Root = styled.View`
  flex: 1;
  background-color: ${({ theme }) => theme.colors.bg};
`

// отступ сверху: угол с балансом монет и значком профиля стоит на одной линии с первой строкой экрана (заголовок оставляет ему место справа)
export const TOP_CORNER = 10

interface ScreenProps {
  children: ReactNode
  // место снизу под плавающую панель табов
  bottomReserve?: number
  refreshControl?: ReactElement<RefreshControlProps>
  // false: экран сам управляет прокруткой (например, списком)
  scroll?: boolean
}

// Экран с учётом вырезов и клавиатуры: отступы от безопасных зон, прокрутка, ввод не прячется под клавиатурой
export function Screen({ children, bottomReserve = 0, refreshControl, scroll = true }: ScreenProps) {
  const insets = useSafeAreaInsets()
  const padding = { paddingTop: insets.top + TOP_CORNER, paddingBottom: insets.bottom + 24 + bottomReserve, paddingHorizontal: 20 }
  return (
    <Root>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        {scroll ? (
          <ScrollView contentContainerStyle={[{ gap: 16 }, padding]} keyboardShouldPersistTaps="handled" refreshControl={refreshControl}>
            {children}
          </ScrollView>
        ) : (
          <View style={[{ flex: 1, gap: 16 }, padding]}>{children}</View>
        )}
      </KeyboardAvoidingView>
    </Root>
  )
}
