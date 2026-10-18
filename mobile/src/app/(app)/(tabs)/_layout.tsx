import { Pressable, Text, View } from 'react-native'
import { TopTabs, type MaterialTopTabBarProps } from 'expo-router/js-top-tabs'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTheme } from 'styled-components/native'
import { useChats } from '@/chat/context'
import { useIdentity } from '@/identity/context'
import { todayIso } from '@/lib/date'
import { countActionable } from '@/lib/occurrences'
import { isParent } from '@/lib/roles'
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

// Плавающая тёмная панель табов («Квест»): значки и подписи, выбранный таб лаймовый. Лежит поверх листаемых страниц.
function FloatingTabBar({ state, navigateToTab, badges }: BarProps) {
  const { colors } = useTheme()
  const insets = useSafeAreaInsets()
  return (
    <View pointerEvents="box-none" style={{ height: 88 + insets.bottom, marginTop: -(88 + insets.bottom), justifyContent: 'flex-end' }}>
      <View
        style={{
          height: 64,
          marginHorizontal: 12,
          marginBottom: 12 + insets.bottom * 0.4,
          borderRadius: 32,
          paddingTop: 6,
          backgroundColor: colors.tabbarBg,
          flexDirection: 'row',
        }}
      >
        {state.routes.map((route, index) => {
          const tab = TABS.find((t) => t.name === route.name)
          if (!tab) return null
          const focused = state.index === index
          const color = focused ? colors.lime : colors.tabbarIcon
          const badge = badges[tab.name]
          return (
            <Pressable
              key={route.key}
              onPress={() => navigateToTab(route.key)}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={tab.title}
              style={{
                flex: 1,
                alignItems: 'center',
                justifyContent: 'center',
                gap: 2,
              }}
            >
              <View>
                <Ionicons name={tab.icon} size={24} color={color} />
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
                      backgroundColor: colors.lime,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Text
                      style={{
                        fontFamily: FONT_FAMILY.black,
                        fontSize: 10,
                        color: colors.onLime,
                      }}
                    >
                      {badge}
                    </Text>
                  </View>
                ) : null}
              </View>
              <Text
                style={{
                  fontFamily: FONT_FAMILY.extraBold,
                  fontSize: 11,
                  color,
                }}
              >
                {tab.title}
              </Text>
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
    <TopTabs tabBarPosition="bottom" tabBar={(props) => <FloatingTabBar {...props} badges={badges} />} screenOptions={{ swipeEnabled: true, lazy: true }}>
      {TABS.map((tab) => (
        <TopTabs.Screen key={tab.name} name={tab.name} options={{ title: tab.title }} />
      ))}
    </TopTabs>
  )
}
