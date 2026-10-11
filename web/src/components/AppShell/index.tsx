import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { ChatsProvider } from '@/chat'
import { Avatar } from '@/components/Avatar'
import { TabBar } from '@/components/TabBar'
import { useIdentity } from '@/identity/context'
import { ProfileProvider } from '@/profile'
import { RealtimeProvider } from '@/realtime'
import { useProfile } from '@/profile/context'
import { Content, ProfileLink, Root } from './styles'

function Shell() {
  const { identity } = useIdentity()
  const { data } = useProfile()
  const { pathname } = useLocation()
  if (!identity) return null

  return (
    <Root>
      {/* на самой странице профиля значок не нужен */}
      {pathname !== '/profile' && (
        <ProfileLink to="/profile" aria-label={`Профиль: ${identity.name}`}>
          <Avatar name={data?.me.name ?? identity.name} seed={identity.memberId} src={data?.me.avatar} />
        </ProfileLink>
      )}
      <Content>
        <Outlet />
      </Content>
      <TabBar />
    </Root>
  )
}

// общий каркас разделов: значок профиля сверху, страница, панель табов снизу
export function AppShell() {
  const { identity } = useIdentity()
  if (!identity) return <Navigate to="/" replace />

  return (
    <RealtimeProvider token={identity.token}>
      <ProfileProvider token={identity.token}>
        <ChatsProvider token={identity.token}>
          <Shell />
        </ChatsProvider>
      </ProfileProvider>
    </RealtimeProvider>
  )
}
