import { useMemo, type ReactNode } from 'react'
import { useColorScheme } from 'react-native'
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
  return <StyledThemeProvider theme={theme}>{children}</StyledThemeProvider>
}

export { darkPalette, lightPalette, type Palette }
