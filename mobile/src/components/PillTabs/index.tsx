import { useState } from 'react'
import { Animated, Pressable, View } from 'react-native'
import { BlurView } from 'expo-blur'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from 'styled-components/native'
import { withAlpha } from '@/lib/colorAlpha'
import { Text } from '../Text'

type IconName = keyof typeof Ionicons.glyphMap

export interface PillTab {
  key: string
  label: string
  icon: IconName
  // число на значке вкладки (например, непрочитанные)
  badge?: number
}

const GAP = 4
const PAD = 5

// Нижняя панель-«таблетка» с несколькими вкладками (как на главных табах): золотая подложка плывёт за листанием страниц.
// `position` это Animated.Value с дробным номером страницы (из onPageScroll пейджера), `index` выбранная вкладка.
export function PillTabs({ tabs, index, position, onPress }: { tabs: PillTab[]; index: number; position: Animated.Value; onPress: (index: number) => void }) {
  const { colors, fontScale, dark } = useTheme()
  const [width, setWidth] = useState(0)
  const tabWidth = width > 0 ? (width - 2 * PAD - 2 - GAP * (tabs.length - 1)) / tabs.length : 0

  return (
    <View
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      style={{
        height: 56,
        borderRadius: 28,
        padding: PAD,
        flexDirection: 'row',
        gap: GAP,
        // как у нижней панели табов: полупрозрачная подложка с лёгким размытием
        backgroundColor: withAlpha(colors.tabbarBg, 0.55),
        borderWidth: 1,
        borderColor: colors.tabbarBorder,
        shadowColor: '#000',
        shadowOpacity: dark ? 0.35 : 0.14,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 6 },
      }}
    >
      <View pointerEvents="none" style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, borderRadius: 27, overflow: 'hidden' }}>
        <BlurView intensity={30} tint={dark ? 'dark' : 'light'} experimentalBlurMethod="dimezisBlurView" style={{ flex: 1 }} />
      </View>
      {tabWidth > 0 && (
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: PAD,
            top: PAD,
            bottom: PAD,
            width: tabWidth,
            borderRadius: 23,
            backgroundColor: colors.tabbarActiveBg,
            transform: [{ translateX: position.interpolate({ inputRange: [0, Math.max(1, tabs.length - 1)], outputRange: [0, Math.max(1, tabs.length - 1) * (tabWidth + GAP)], extrapolate: 'clamp' }) }],
          }}
        />
      )}
      {tabs.map((tab, i) => {
        const active = i === index
        const color = active ? colors.tabbarActiveText : colors.tabbarIcon
        return (
          <Pressable
            key={tab.key}
            onPress={() => onPress(i)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}
          >
            <Ionicons name={tab.icon} size={20} color={color} />
            <Text $weight="extraBold" $size={13} style={{ color }}>
              {tab.label}
            </Text>
            {tab.badge ? (
              <View style={{ minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 5, alignItems: 'center', justifyContent: 'center', backgroundColor: active ? colors.tabbarActiveText : colors.lime }}>
                <Text style={{ fontSize: 10 * fontScale, lineHeight: 14 * fontScale, fontWeight: '900', color: active ? colors.tabbarActiveBg : colors.onLime }}>{tab.badge > 99 ? '99+' : tab.badge}</Text>
              </View>
            ) : null}
          </Pressable>
        )
      })}
    </View>
  )
}
