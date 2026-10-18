import { Tabs, usePathname } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
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

// переписка (/chat/<чат>) занимает весь экран, без панели табов
const inChatRoom = (pathname: string) => pathname.startsWith('/chat/') && pathname.length > '/chat/'.length

// Четыре главных раздела с плавающей тёмной панелью табов («Квест»). Остальные разделы (профиль, монеты, цели, календарь) лежат рядом,
// в `(app)`, обычными экранами поверх: скрытые вкладки в этой версии Expo Router не открываются, а перенаправляют на первую вкладку.
export default function TabsLayout() {
  const { colors } = useTheme()
  const badge = useTaskBadge()
  const { unread } = useChats()
  const pathname = usePathname()
  const hideBar = inChatRoom(pathname)

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.lime,
        tabBarInactiveTintColor: colors.tabbarIcon,
        tabBarLabelStyle: { fontFamily: FONT_FAMILY.extraBold, fontSize: 11 },
        tabBarBadgeStyle: { backgroundColor: colors.lime, color: colors.onLime, fontFamily: FONT_FAMILY.black },
        tabBarStyle: {
          position: 'absolute',
          left: 12,
          right: 12,
          bottom: 12,
          height: 64,
          borderRadius: 32,
          borderTopWidth: 0,
          paddingTop: 6,
          backgroundColor: colors.tabbarBg,
          display: hideBar ? 'none' : 'flex',
        },
      }}
    >
      {TABS.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: tab.title,
            tabBarBadge: tab.name === 'tasks' ? badge : tab.name === 'chat' && unread > 0 ? unread : undefined,
            tabBarIcon: ({ color, size }) => <Ionicons name={tab.icon} size={size} color={String(color)} />,
          }}
        />
      ))}
    </Tabs>
  )
}
