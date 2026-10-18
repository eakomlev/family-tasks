import type { ReactElement, ReactNode } from 'react'
import { KeyboardAvoidingView, ScrollView, View, type RefreshControlProps } from 'react-native'
import { usePathname } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import styled from 'styled-components/native'
import { TAB_BAR_RESERVE, tabBarVisible } from '@/lib/tabBar'

const Root = styled.View`
  flex: 1;
  background-color: ${({ theme }) => theme.colors.bg};
`

// отступ сверху: угол с балансом монет и значком профиля стоит на одной линии с первой строкой экрана (заголовок оставляет ему место справа)
export const TOP_CORNER = 10

interface ScreenProps {
  children: ReactNode
  // место снизу под плавающую панель табов; по умолчанию считается по адресу экрана (есть панель или нет)
  bottomReserve?: number
  refreshControl?: ReactElement<RefreshControlProps>
  // false: экран сам управляет прокруткой (например, списком)
  scroll?: boolean
}

// Экран с учётом вырезов и клавиатуры: отступы от безопасных зон, прокрутка, ввод не прячется под клавиатурой
export function Screen({ children, bottomReserve, refreshControl, scroll = true }: ScreenProps) {
  const insets = useSafeAreaInsets()
  const pathname = usePathname()
  const reserve = bottomReserve ?? (tabBarVisible(pathname) ? TAB_BAR_RESERVE : 0)
  const padding = { paddingTop: insets.top + TOP_CORNER, paddingBottom: insets.bottom + 24 + reserve, paddingHorizontal: 20 }
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
