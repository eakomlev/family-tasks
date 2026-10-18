import { Nunito_500Medium, Nunito_700Bold, Nunito_800ExtraBold, Nunito_900Black } from '@expo-google-fonts/nunito'

// Шрифт Nunito лежит в приложении (в сборку, а не из сети): 900 для заголовков и чисел, 700–800 для подписей, 500 для текста
export const FONT_ASSETS = { Nunito_500Medium, Nunito_700Bold, Nunito_800ExtraBold, Nunito_900Black }

export type FontWeight = 'regular' | 'bold' | 'extraBold' | 'black'

export const FONT_FAMILY: Record<FontWeight, string> = {
  regular: 'Nunito_500Medium',
  bold: 'Nunito_700Bold',
  extraBold: 'Nunito_800ExtraBold',
  black: 'Nunito_900Black',
}
