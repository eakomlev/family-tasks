import { Redirect, Tabs } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from 'styled-components/native'
import { useIdentity } from '@/identity/context'
import { ProfileProvider } from '@/profile'
import { RealtimeProvider } from '@/realtime'
import { RealtimeBridge } from '@/store/RealtimeBridge'
import { FONT_FAMILY } from '@/theme/fonts'

type IconName = keyof typeof Ionicons.glyphMap

const TABS: { name: string; title: string; icon: IconName }[] = [
  { name: 'index', title: 'Мой день', icon: 'sunny-outline' },
  { name: 'tasks', title: 'Задачи', icon: 'checkmark-circle-outline' },
  { name: 'chat', title: 'Чат', icon: 'chatbubble-outline' },
  { name: 'family', title: 'Семья', icon: 'people-outline' },
]

// Экраны вошедшего: профиль и сигналы сервера по сокету, внизу плавающая тёмная панель табов («Квест»)
export default function AppLayout() {
  const { identity } = useIdentity()
  const { colors } = useTheme()
  if (!identity) return <Redirect href="/welcome" />

  return (
    <RealtimeProvider token={identity.token}>
      <ProfileProvider>
        <RealtimeBridge />
        <Tabs
          screenOptions={{
            headerShown: false,
            tabBarActiveTintColor: colors.lime,
            tabBarInactiveTintColor: colors.tabbarIcon,
            tabBarLabelStyle: { fontFamily: FONT_FAMILY.extraBold, fontSize: 11 },
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
            },
          }}
        >
          {TABS.map((tab) => (
            <Tabs.Screen
              key={tab.name}
              name={tab.name}
              options={{
                title: tab.title,
                tabBarIcon: ({ color, size }) => <Ionicons name={tab.icon} size={size} color={String(color)} />,
              }}
            />
          ))}
        </Tabs>
      </ProfileProvider>
    </RealtimeProvider>
  )
}
