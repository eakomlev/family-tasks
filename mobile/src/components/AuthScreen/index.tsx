import type { ReactNode } from 'react'
import { KeyboardAvoidingView, ScrollView, View } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTheme } from 'styled-components/native'
import { AppLogo } from '../AppLogo'

// Фон и колонка экранов входа: градиент «Квеста» на весь экран, логотип и контент поверх
export function AuthScreen({ children }: { children: ReactNode }) {
  const { colors } = useTheme()
  const insets = useSafeAreaInsets()
  return (
    <LinearGradient colors={[colors.authA, colors.authB, colors.authC]} style={{ flex: 1 }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ flexGrow: 1, gap: 20, paddingHorizontal: 24, paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }}
        >
          <View style={{ alignItems: 'flex-start' }}>
            <AppLogo />
          </View>
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  )
}
