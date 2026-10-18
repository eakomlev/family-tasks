import type { ReactElement, ReactNode } from 'react'
import { KeyboardAvoidingView, ScrollView, View, type RefreshControlProps } from 'react-native'
import { usePathname } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import styled, { useTheme } from 'styled-components/native'
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
  // шапка страницы: остаётся наверху при прокрутке (под ней уезжает остальное); берёт на себя верхний отступ безопасной зоны
  header?: ReactNode
}

// Экран с учётом вырезов и клавиатуры: отступы от безопасных зон, прокрутка, ввод не прячется под клавиатурой
export function Screen({ children, bottomReserve, refreshControl, scroll = true, header }: ScreenProps) {
  const { colors } = useTheme()
  const insets = useSafeAreaInsets()
  const pathname = usePathname()
  const reserve = bottomReserve ?? (tabBarVisible(pathname) ? TAB_BAR_RESERVE : 0)
  const padding = { paddingTop: header ? 0 : insets.top + TOP_CORNER, paddingBottom: insets.bottom + 24 + reserve, paddingHorizontal: 20 }
  // у шапки свой фон и отступы: под ней при прокрутке скрывается содержимое
  const bar = header ? (
    <View style={{ backgroundColor: colors.bg, paddingTop: insets.top + TOP_CORNER, paddingBottom: 6, marginHorizontal: -20, paddingHorizontal: 20 }}>{header}</View>
  ) : null
  return (
    <Root>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        {scroll ? (
          <ScrollView contentContainerStyle={[{ gap: 16 }, padding]} keyboardShouldPersistTaps="handled" refreshControl={refreshControl} stickyHeaderIndices={bar ? [0] : undefined}>
            {bar}
            {children}
          </ScrollView>
        ) : (
          <View style={[{ flex: 1, gap: 16 }, padding]}>
            {bar}
            {children}
          </View>
        )}
      </KeyboardAvoidingView>
    </Root>
  )
}
