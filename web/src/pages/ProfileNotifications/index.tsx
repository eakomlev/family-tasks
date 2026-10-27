import { PageHeader } from '@/components/PageHeader'
import { SlideInPage as Page } from '@/components/Page'
import { useIdentity } from '@/identity/context'
import { NotificationsSetting } from './components/NotificationsSetting'
import { SoundsSetting } from './components/SoundsSetting'

// Уведомления и звуки: уведомления на этом устройстве (включить, проверить, выключить) и звуки приложения
export default function ProfileNotifications() {
  const { identity } = useIdentity()
  return (
    <Page>
      <PageHeader to="/profile">Уведомления и звуки</PageHeader>
      {identity && <NotificationsSetting token={identity.token} />}
      <SoundsSetting />
    </Page>
  )
}
