import { Navigate, Outlet } from 'react-router-dom'
import { Avatar } from '@/components/Avatar'
import { TabBar } from '@/components/TabBar'
import { useIdentity } from '@/identity/context'
import { Content, ProfileLink, Root } from './styles'

// общий каркас разделов: значок профиля сверху, страница, панель табов снизу
export function AppShell() {
  const { identity } = useIdentity()
  if (!identity) return <Navigate to="/" replace />

  return (
    <Root>
      <ProfileLink to="/settings" aria-label={`Профиль: ${identity.name}. Настройки`}>
        <Avatar name={identity.name} seed={identity.memberId} />
      </ProfileLink>
      <Content>
        <Outlet />
      </Content>
      <TabBar />
    </Root>
  )
}
