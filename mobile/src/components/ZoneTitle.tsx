import type { ReactNode } from 'react'
import { View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from 'styled-components/native'
import { Heading, Text } from '@/components/Text'

// Зоны «Моего дня»: нужно решить, мой день, дети, игры
export type ZoneTone = 'decide' | 'mine' | 'kids' | 'games'
export type ZoneIcon = 'hourglass' | 'games' | 'tasks' | 'kids' | 'lessons' | 'training'

const ICONS: Record<ZoneIcon, keyof typeof Ionicons.glyphMap> = {
  hourglass: 'hourglass-outline',
  games: 'game-controller-outline',
  tasks: 'checkbox-outline',
  kids: 'people-outline',
  lessons: 'book-outline',
  training: 'barbell-outline',
}

interface Props {
  tone: ZoneTone
  icon: ZoneIcon
  children: string
  // число рядом с названием (сколько ждёт, сколько идёт)
  count?: number
  // справа: ссылки вроде «Расписание»
  right?: ReactNode
}

// Шапка зоны на «Моём дне»: цветной значок, название, цветная линия и, если нужно, счётчик. Цвет зоны один на все её блоки
// (токены zone* в палитре, те же значения, что в вебе).
export function ZoneTitle({ tone, icon, children, count, right }: Props) {
  const { colors } = useTheme()
  const c = {
    decide: { bg: colors.zoneDecideBg, fg: colors.zoneDecideFg, line: colors.zoneDecideLine },
    mine: { bg: colors.zoneMineBg, fg: colors.zoneMineFg, line: colors.zoneMineLine },
    kids: { bg: colors.zoneKidsBg, fg: colors.zoneKidsFg, line: colors.zoneKidsLine },
    games: { bg: colors.zoneGamesBg, fg: colors.zoneGamesFg, line: colors.zoneGamesLine },
  }[tone]

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 8 }}>
      <View style={{ width: 30, height: 30, borderRadius: 10, backgroundColor: c.bg, alignItems: 'center', justifyContent: 'center' }} accessibilityElementsHidden importantForAccessibility="no">
        <Ionicons name={ICONS[icon]} size={18} color={c.fg} />
      </View>
      <Heading style={{ color: c.fg, flexShrink: 1 }}>{children}</Heading>
      {count !== undefined && (
        <View style={{ minWidth: 22, paddingHorizontal: 6, height: 22, borderRadius: 11, backgroundColor: c.line, alignItems: 'center', justifyContent: 'center' }} accessibilityLabel={`Число: ${count}`}>
          <Text $size={12} $weight="black" style={{ color: '#ffffff' }}>
            {String(count)}
          </Text>
        </View>
      )}
      <View style={{ flex: 1, height: 2, borderRadius: 1, backgroundColor: c.line, opacity: 0.45 }} />
      {right}
    </View>
  )
}
