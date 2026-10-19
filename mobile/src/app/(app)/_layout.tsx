import { Pressable, View } from 'react-native'
import { Redirect, Stack, usePathname, useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from 'styled-components/native'
import { ChatsProvider } from '@/chat'
import { Avatar } from '@/components/Avatar'
import { CoinBalance } from '@/components/Coins'
import { loadTasksView } from '@/features/tasks/viewState'
import { useIdentity } from '@/identity/context'
import { ProfileProvider } from '@/profile'
import { NotificationsBridge } from '@/features/notifications/NotificationsBridge'
import { useProfile } from '@/profile/context'
import { RealtimeProvider } from '@/realtime'
import { RealtimeBridge } from '@/store/RealtimeBridge'

// переписка (/chat/<чат>) занимает весь экран
const inChatRoom = (pathname: string) => pathname.startsWith('/chat/') && pathname.length > '/chat/'.length

// Правый верхний угол: баланс монет ребёнка и значок профиля (только на «Моём дне») или «＋» новой задачи (на «Заданиях»)
function TopRight() {
  const { identity } = useIdentity()
  const { data } = useProfile()
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const { colors } = useTheme()
  const pathname = usePathname()
  if (!identity) return null
  // в переписке угол не нужен: он перекрыл бы шапку
  if (inChatRoom(pathname)) return null
  // у календаря справа свои кнопки («＋» и настройки)
  if (pathname === '/calendar') return null
  // значок профиля только на «Моём дне»; в остальных разделах в профиль попадают из «Семьи»
  const showAvatar = pathname === '/'
  // на «Заданиях» вместо значка профиля кнопка «＋»: новое задание (выбранный в фильтре человек сразу становится исполнителем)
  const showAdd = pathname === '/tasks'
  const coins = data?.me.coins

  return (
    <View style={{ position: 'absolute', top: insets.top + 8, right: 16, flexDirection: 'row', alignItems: 'center', gap: 10, zIndex: 10 }} pointerEvents="box-none">
      {coins !== undefined && <CoinBalance coins={coins} />}
      {showAdd && (
        <Pressable
          onPress={() => {
            const filter = loadTasksView(identity.memberId).filter
            router.push(filter ? { pathname: '/tasks/new', params: { assignee: filter } } : '/tasks/new')
          }}
          accessibilityRole="button"
          accessibilityLabel="Новая задача"
          style={{ width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accent }}
        >
          <Ionicons name="add" size={26} color="#ffffff" />
        </Pressable>
      )}
      {showAvatar && (
        <Pressable onPress={() => router.push('/profile')} accessibilityRole="button" accessibilityLabel={`Профиль: ${identity.name}`}>
          <Avatar name={data?.me.name ?? identity.name} seed={identity.memberId} src={data?.me.avatar} size={38} />
        </Pressable>
      )}
    </View>
  )
}

// Экраны вошедшего: профиль и сигналы сервера по сокету. Внутри группа `(tabs)` с четырьмя главными разделами и панелью табов,
// рядом обычные экраны (профиль, монеты, цели, календарь, отчёт об уроке), которые открываются поверх.
export default function AppLayout() {
  const { identity } = useIdentity()
  if (!identity) return <Redirect href="/welcome" />

  return (
    <RealtimeProvider token={identity.token}>
      <ProfileProvider>
        <RealtimeBridge />
        <NotificationsBridge />
        <ChatsProvider>
          <Stack screenOptions={{ headerShown: false }} />
          <TopRight />
        </ChatsProvider>
      </ProfileProvider>
    </RealtimeProvider>
  )
}
