import { useEffect, useMemo, type ReactNode } from 'react'
import { Appearance, useColorScheme } from 'react-native'
import { StatusBar } from 'expo-status-bar'
import { ThemeProvider as StyledThemeProvider } from 'styled-components/native'
import { darkPalette, lightPalette, type Palette } from './palettes'
import { useThemePreference } from './preference'

export interface AppTheme {
  colors: Palette
  dark: boolean
  radiusCard: number
}

declare module 'styled-components/native' {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  export interface DefaultTheme extends AppTheme {}
}

export const makeTheme = (dark: boolean): AppTheme => ({ colors: dark ? darkPalette : lightPalette, dark, radiusCard: 22 })

// Тема: явный выбор из профиля («светлая», «тёмная») или системная
export function ThemeProvider({ children }: { children: ReactNode }) {
  const scheme = useColorScheme()
  const preference = useThemePreference()
  const dark = preference === 'system' ? scheme === 'dark' : preference === 'dark'
  const theme = useMemo(() => makeTheme(dark), [dark])
  // Явный выбор темы в приложении распространяем на систему (окна выбора фото, клавиатура, диалоги); «как в системе» возвращает управление ей
  useEffect(() => {
    Appearance.setColorScheme(preference === 'system' ? 'unspecified' : preference)
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
