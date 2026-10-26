import { useEffect, useMemo, type ReactNode } from 'react'
import { Appearance, useColorScheme } from 'react-native'
import { StatusBar } from 'expo-status-bar'
import { ThemeProvider as StyledThemeProvider } from 'styled-components/native'
import { darkPalette, lightPalette, type Palette } from './palettes'
import { useFontScale } from './fontScale'
import { useThemePreference } from './preference'

export interface AppTheme {
  colors: Palette
  dark: boolean
  radiusCard: number
  // множитель размеров текста из «Настроек» профиля (1 — стандартный)
  fontScale: number
}

declare module 'styled-components/native' {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  export interface DefaultTheme extends AppTheme {}
}

export const makeTheme = (dark: boolean, fontScale = 1): AppTheme => ({ colors: dark ? darkPalette : lightPalette, dark, radiusCard: 22, fontScale })

// Тема: явный выбор из профиля («светлая», «тёмная») или системная
export function ThemeProvider({ children }: { children: ReactNode }) {
  const scheme = useColorScheme()
  const preference = useThemePreference()
  const dark = preference === 'system' ? scheme === 'dark' : preference === 'dark'
  const fontScale = useFontScale()
  const theme = useMemo(() => makeTheme(dark, fontScale), [dark, fontScale])
  // Явный выбор темы в приложении распространяем на систему (окна выбора фото, клавиатура, диалоги); «как в системе» возвращает управление ей
  useEffect(() => {
    // в веб-просмотре (react-native-web) этого метода нет
    Appearance.setColorScheme?.(preference === 'system' ? 'unspecified' : preference)
  }, [preference])
  return (
    <StyledThemeProvider theme={theme}>
      {/* значки системной строки по теме приложения, а не по системной: светлая тема в тёмной системе иначе даёт белое на белом */}
      <StatusBar style={dark ? 'light' : 'dark'} />
      {children}
    </StyledThemeProvider>
  )
}

export { darkPalette, lightPalette, type Palette }
