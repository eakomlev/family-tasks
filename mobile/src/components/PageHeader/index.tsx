import type { ReactNode } from 'react'
import { View } from 'react-native'
import type { Href } from 'expo-router'
import { BackLink } from '../BackLink'
import { TOP_RIGHT_RESERVE, Text } from '../Text'

// Шапка страницы: стрелка «назад» слева и заголовок рядом, на одной линии со значком профиля (справа остаётся место под угол с монетами)
export function PageHeader({ fallback, children }: { fallback: Href; children: ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingRight: TOP_RIGHT_RESERVE, minHeight: 44 }}>
      <BackLink fallback={fallback} />
      <Text $weight="black" $size={22} style={{ flex: 1, lineHeight: 28 }} accessibilityRole="header">
        {children}
      </Text>
    </View>
  )
}
