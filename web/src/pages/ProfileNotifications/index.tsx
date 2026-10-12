import { BackLink } from '@/components/BackLink'
import { SlideInPage as Page } from '@/components/Page'
import { useIdentity } from '@/identity/context'
import { NotificationsSetting } from './components/NotificationsSetting'

// Уведомления на этом устройстве: включить, проверить, выключить
export default function ProfileNotifications() {
  const { identity } = useIdentity()
  return (
    <Page>
      <BackLink to="/profile">← Профиль</BackLink>
      {identity && <NotificationsSetting token={identity.token} />}
    </Page>
  )
}
