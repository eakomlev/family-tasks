import { Navigate, Outlet } from 'react-router-dom'
import { TabBar } from '@/components/TabBar'
import { useIdentity } from '@/identity/context'
import { Content, Root } from './styles'

// общий каркас разделов: страница сверху, панель табов снизу
export function AppShell() {
  const { identity } = useIdentity()
  if (!identity) return <Navigate to="/" replace />

  return (
    <Root>
      <Content>
        <Outlet />
      </Content>
      <TabBar />
    </Root>
  )
}
