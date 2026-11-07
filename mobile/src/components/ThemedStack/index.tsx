import { Stack } from 'expo-router'
import { useTheme } from 'styled-components/native'

// Цвет сцены задаём явно, чтобы при жестах между экранами не просвечивал белый фон системы.
export function ThemedStack() {
  const { colors } = useTheme()
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }} />
}
