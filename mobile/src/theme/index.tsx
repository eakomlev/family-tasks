import { useMemo, type ReactNode } from 'react'
import { useColorScheme } from 'react-native'
import { ThemeProvider as StyledThemeProvider } from 'styled-components/native'
import { darkPalette, lightPalette, type Palette } from './palettes'

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

// Тема следует за системной (светлая или тёмная); явный выбор «как в системе / светлая / тёмная» добавится вместе с профилем
export function ThemeProvider({ children }: { children: ReactNode }) {
  const scheme = useColorScheme()
  const theme = useMemo(() => makeTheme(scheme === 'dark'), [scheme])
  return <StyledThemeProvider theme={theme}>{children}</StyledThemeProvider>
}

export { darkPalette, lightPalette, type Palette }
