import { Pressable, View } from 'react-native'
import { Redirect, Tabs, usePathname, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTheme } from 'styled-components/native'
import { ChatsProvider } from '@/chat'
import { useChats } from '@/chat/context'
import { Avatar } from '@/components/Avatar'
import { CoinBalance } from '@/components/Coins'
import { useIdentity } from '@/identity/context'
import { todayIso } from '@/lib/date'
import { countActionable } from '@/lib/occurrences'
import { isParent } from '@/lib/roles'
import { useNow } from '@/lib/useNow'
import { ProfileProvider } from '@/profile'
import { useProfile } from '@/profile/context'
import { RealtimeProvider } from '@/realtime'
import { RealtimeBridge } from '@/store/RealtimeBridge'
import { useListPendingTasksQuery, useListTasksQuery } from '@/store/tasks'
import { FONT_FAMILY } from '@/theme/fonts'

type IconName = keyof typeof Ionicons.glyphMap

const TABS: { name: string; title: string; icon: IconName }[] = [
  { name: 'index', title: 'Мой день', icon: 'sunny-outline' },
  { name: 'tasks', title: 'Задачи', icon: 'checkmark-circle-outline' },
  { name: 'chat', title: 'Чат', icon: 'chatbubble-outline' },
  { name: 'family', title: 'Семья', icon: 'people-outline' },
]

// разделы без своего таба: открываются из других экранов
const HIDDEN = ['coins', 'goals', 'profile', 'lesson-report', 'calendar']

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

// Правый верхний угол: баланс монет ребёнка и значок профиля (на самой странице профиля значка нет)
function TopRight() {
  const { identity } = useIdentity()
  const { data } = useProfile()
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const pathname = usePathname()
  if (!identity) return null
  const onProfile = pathname.startsWith('/profile') || pathname === '/calendar'
  // в переписке угол не нужен: он перекрыл бы шапку
  if (inChatRoom(pathname)) return null
  const coins = data?.me.coins

  return (
    <View style={{ position: 'absolute', top: insets.top + 8, right: 16, flexDirection: 'row', alignItems: 'center', gap: 10, zIndex: 10 }} pointerEvents="box-none">
      {coins !== undefined && <CoinBalance coins={coins} />}
      {!onProfile && (
        <Pressable onPress={() => router.push('/profile')} accessibilityRole="button" accessibilityLabel={`Профиль: ${identity.name}`}>
          <Avatar name={data?.me.name ?? identity.name} seed={identity.memberId} src={data?.me.avatar} size={38} />
        </Pressable>
      )}
    </View>
  )
}

function TabsWithBadge() {
  const { colors } = useTheme()
  const badge = useTaskBadge()
  const { unread } = useChats()
  const pathname = usePathname()
  const hideBar = inChatRoom(pathname)
  return (
    <>
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
        {HIDDEN.map((name) => (
          <Tabs.Screen key={name} name={name} options={{ href: null }} />
        ))}
      </Tabs>
      <TopRight />
    </>
  )
}

// Экраны вошедшего: профиль и сигналы сервера по сокету, внизу плавающая тёмная панель табов («Квест»)
export default function AppLayout() {
  const { identity } = useIdentity()
  if (!identity) return <Redirect href="/welcome" />

  return (
    <RealtimeProvider token={identity.token}>
      <ProfileProvider>
        <RealtimeBridge />
        <ChatsProvider>
          <TabsWithBadge />
        </ChatsProvider>
      </ProfileProvider>
    </RealtimeProvider>
  )
}
