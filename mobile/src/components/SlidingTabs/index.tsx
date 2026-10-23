import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Animated, Easing, Pressable, View } from 'react-native'
import { useTheme } from 'styled-components/native'

export interface SlidingTab {
  key: string
  accessibilityLabel?: string
  // содержимое вкладки; active подсказывает, что подложка под ней
  render: (active: boolean) => ReactNode
}

const PAD = 3
const GAP = 2
// короткая, чтобы переключение не казалось медленным
const DURATION = 200

// Переключатель вкладок равной ширины: цветная подложка плавно переезжает под выбранную вкладку.
export function SlidingTabs({ tabs, selected, onSelect, radius = 16 }: { tabs: SlidingTab[]; selected: string; onSelect: (key: string) => void; radius?: number }) {
  const { colors } = useTheme()
  const [width, setWidth] = useState(0)
  const index = Math.max(0, tabs.findIndex((t) => t.key === selected))
  const tabWidth = width > 0 ? (width - 2 * PAD - 2 - GAP * (tabs.length - 1)) / tabs.length : 0
  const x = useRef(new Animated.Value(index)).current

  useEffect(() => {
    Animated.timing(x, { toValue: index, duration: DURATION, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start()
  }, [index, x])

  return (
    <View
      accessibilityRole="tablist"
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      style={{ flexDirection: 'row', gap: GAP, padding: PAD, borderRadius: radius + PAD, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }}
    >
      {tabWidth > 0 && (
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: PAD,
            top: PAD,
            bottom: PAD,
            width: tabWidth,
            borderRadius: radius,
            backgroundColor: colors.accent,
            transform: [{ translateX: x.interpolate({ inputRange: [0, 1], outputRange: [0, tabWidth + GAP] }) }],
          }}
        />
      )}
      {tabs.map((tab) => {
        const active = tab.key === selected
        return (
          <Pressable
            key={tab.key}
            onPress={() => onSelect(tab.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={tab.accessibilityLabel}
            style={{ flex: 1, minWidth: 0, minHeight: 38, alignItems: 'center', justifyContent: 'center', paddingVertical: 5, paddingHorizontal: 4 }}
          >
            {tab.render(active)}
          </Pressable>
        )
      })}
    </View>
  )
}
