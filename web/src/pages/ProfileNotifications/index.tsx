import { PageHeader } from '@/components/PageHeader'
import { SlideInPage as Page } from '@/components/Page'
import { useIdentity } from '@/identity/context'
import { NotificationsSetting } from './components/NotificationsSetting'

// Уведомления на этом устройстве: включить, проверить, выключить
export default function ProfileNotifications() {
  const { identity } = useIdentity()
  return (
    <Page>
      <PageHeader to="/profile">Уведомления</PageHeader>
      {identity && <NotificationsSetting token={identity.token} />}
    </Page>
  )
}
