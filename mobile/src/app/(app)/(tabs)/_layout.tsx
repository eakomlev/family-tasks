import { useEffect, useState } from 'react'
import { Animated, Pressable, Text, View } from 'react-native'
import { TopTabs, type MaterialTopTabBarProps } from 'expo-router/js-top-tabs'
import { Ionicons } from '@expo/vector-icons'
import { BlurView } from 'expo-blur'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTheme } from 'styled-components/native'
import { useChats } from '@/chat/context'
import { useIdentity } from '@/identity/context'
import { withAlpha } from '@/lib/colorAlpha'
import { todayIso } from '@/lib/date'
import { countActionable } from '@/lib/occurrences'
import { isParent } from '@/lib/roles'
import { emitTabReselect } from '@/lib/tabBar'
import { useNow } from '@/lib/useNow'
import { useListPendingTasksQuery, useListTasksQuery } from '@/store/tasks'
import { FONT_FAMILY } from '@/theme/fonts'

type IconName = keyof typeof Ionicons.glyphMap

const TABS: { name: string; title: string; icon: IconName }[] = [
  { name: 'index', title: 'Мой день', icon: 'sunny-outline' },
  { name: 'tasks', title: 'Задачи', icon: 'checkmark-circle-outline' },
  { name: 'chat', title: 'Чат', icon: 'chatbubble-outline' },
  { name: 'family', title: 'Семья', icon: 'people-outline' },
]

// Сколько заданий ждёт действия: значок на табе «Задачи». Берёт те же запросы, что «Мой день» (в кэше они общие).
function useTaskBadge(): number | undefined {
  const { identity } = useIdentity()
  const today = todayIso(useNow())
  const { data: current } = useListTasksQuery({ from: today, to: today })
  const { data: pending } = useListPendingTasksQuery()
  const count = current && pending && identity ? countActionable(current, pending, identity.memberId, isParent(identity.role), today) : 0
  return count > 0 ? count : undefined
}

type BarProps = MaterialTopTabBarProps & {
  badges: Record<string, number | undefined>
}

// Плавающая тёмная панель табов («Квест»): значки и подписи; выбранный таб лежит на золотой капсуле (цвет домика на значке) с тёмным значком, остальные приглушены.
// Лежит поверх листаемых страниц.
function FloatingTabBar({ state, navigateToTab, badges, position }: BarProps) {
  const { colors, dark, fontScale } = useTheme()
  const insets = useSafeAreaInsets()
  // Подсветка идёт за самой страницей, а не за состоянием навигации: оно обновляется, когда пролистывание закончилось, и подсветка отставала.
  // «Ближайший» таб считаем по положению страниц (меняется на полпути между соседями), по нажатию подсвечиваем сразу.
  const [near, setNear] = useState(state.index)
  const [barWidth, setBarWidth] = useState(0)
  useEffect(() => setNear(state.index), [state.index])
  useEffect(() => {
    const id = position.addListener(({ value }) => setNear(Math.round(value)))
    return () => position.removeListener(id)
  }, [position])
  const count = state.routes.length
  const GAP = 4
  const PAD = 5
  const tabWidth = barWidth > 0 ? (barWidth - 2 * PAD - 2 - GAP * (count - 1)) / count : 0
  return (
    <View pointerEvents="box-none" style={{ height: 88 + insets.bottom, marginTop: -(88 + insets.bottom), justifyContent: 'flex-end' }}>
      <View
        style={{
          height: 64,
          marginHorizontal: 12,
          marginBottom: 12 + insets.bottom * 0.4,
          borderRadius: 32,
          padding: PAD,
          // подложка полупрозрачная, под ней лёгкое размытие (BlurView ниже); цвет акцентной капсулы и значков не меняется
          backgroundColor: withAlpha(colors.tabbarBg, 0.72),
          borderWidth: 1,
          borderColor: colors.tabbarBorder,
          flexDirection: 'row',
          gap: GAP,
          shadowColor: '#000',
          shadowOpacity: dark ? 0.35 : 0.14,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 6 },
          // на Android тень под полупрозрачной подложкой просвечивала бы: оставляем только рамку
          elevation: 0,
        }}
        onLayout={(e) => setBarWidth(e.nativeEvent.layout.width)}
      >
        <View pointerEvents="none" style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, borderRadius: 31, overflow: 'hidden' }}>
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
              borderRadius: 27,
              backgroundColor: colors.tabbarActiveBg,
              transform: [{ translateX: position.interpolate({ inputRange: [0, count - 1], outputRange: [0, (count - 1) * (tabWidth + GAP)], extrapolate: 'clamp' }) }],
            }}
          />
        )}
        {state.routes.map((route, index) => {
          const tab = TABS.find((t) => t.name === route.name)
          if (!tab) return null
          const focused = near === index
          const color = focused ? colors.tabbarActiveText : colors.tabbarIcon
          const badge = badges[tab.name]
          return (
            <Pressable
              key={route.key}
              onPress={() => {
                if (state.index === index) emitTabReselect()
                setNear(index)
                navigateToTab(route.key)
              }}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={tab.title}
              style={{
                flex: 1,
                alignItems: 'center',
                justifyContent: 'center',
                gap: 1,
                borderRadius: 27,
              }}
            >
              <View>
                <Ionicons name={tab.icon} size={23} color={color} />
                {badge ? (
                  <View
                    style={{
                      position: 'absolute',
                      top: -4,
                      right: -10,
                      minWidth: 16,
                      height: 16,
                      borderRadius: 8,
                      paddingHorizontal: 4,
                      // у выбранного таба подложка уже цветная: бейдж цветом текста таба
                      backgroundColor: focused ? colors.tabbarActiveText : colors.lime,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Text style={{ fontFamily: FONT_FAMILY.black, fontSize: 10 * fontScale, color: focused ? colors.tabbarActiveBg : colors.onLime }}>{badge}</Text>
                  </View>
                ) : null}
              </View>
              <Text style={{ fontFamily: FONT_FAMILY.extraBold, fontSize: 11 * fontScale, color }}>{tab.title}</Text>
            </Pressable>
          )
        })}
      </View>
    </View>
  )
}

// Четыре главных раздела: страницы листаются пальцем влево и вправо (как страницы), панель табов плавающая. Остальные экраны (задание,
// переписка, профиль, календарь…) лежат рядом, в `(app)`, общим стеком поверх табов: скрытые вкладки в Expo Router не открываются.
export default function TabsLayout() {
  const taskBadge = useTaskBadge()
  const { unread } = useChats()
  const badges = { tasks: taskBadge, chat: unread > 0 ? unread : undefined }

  return (
    <TopTabs tabBarPosition="bottom" tabBar={(props) => <FloatingTabBar {...props} badges={badges} />} screenOptions={{ swipeEnabled: true, lazy: true, lazyPreloadDistance: 1 }}>
      {TABS.map((tab) => (
        <TopTabs.Screen key={tab.name} name={tab.name} options={{ title: tab.title }} />
      ))}
    </TopTabs>
  )
}
