import type { ReactNode } from 'react'
import { View } from 'react-native'
import { useTheme } from 'styled-components/native'
import type { Href } from 'expo-router'
import { BackLink } from '../BackLink'
import { TOP_RIGHT_RESERVE, Text } from '../Text'

// Шапка страницы: стрелка «назад» слева и заголовок рядом на одной линии со значком профиля (справа остаётся место под угол с монетами,
// а если задан `right`, то под него). Стрелка и заголовок центрируются по высоте строки, у шрифта убраны лишние поля Android.
export function PageHeader({ fallback, children, right }: { fallback: Href; children: ReactNode; right?: ReactNode }) {
  const { fontScale } = useTheme()
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingRight: right ? 0 : TOP_RIGHT_RESERVE, minHeight: 44 }}>
      <BackLink fallback={fallback} />
      <Text $weight="black" $size={22} style={{ flex: 1, lineHeight: Math.round(28 * fontScale), includeFontPadding: false, textAlignVertical: 'center' }} accessibilityRole="header">
        {children}
      </Text>
      {right}
    </View>
  )
}
