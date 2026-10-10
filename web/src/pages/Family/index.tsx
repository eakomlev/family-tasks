import { Navigate } from 'react-router-dom'
import { logout } from '@/api'
import { Button } from '@/components/Button'
import { Notice } from '@/components/Notice'
import { Page } from '@/components/Page'
import { useIdentity } from '@/identity/context'
import { ROLE_LABELS } from '@/lib/roles'
import { useProfile } from '@/profile/context'
import { InviteSection } from './components/InviteSection'
import { MemberRow } from './components/MemberRow'
import { Members } from './styles'

export default function Family() {
  const { identity, clear } = useIdentity()
  const { data, failed } = useProfile()

  async function handleLogout() {
    if (!identity) return
    // даже если сервер недоступен, на этом устройстве всё равно выходим
    await logout(identity.token).catch(() => {})
    await clear()
  }

  if (!identity) return <Navigate to="/" replace />

  return (
    <Page>
      <h1>Ваша семья</h1>
      <p>Вы вошли как <strong>{identity.name}</strong> ({ROLE_LABELS[identity.role]}). Код семьи: <code>{identity.familyCode}</code></p>

      {data?.me.isOwner && <InviteSection token={identity.token} />}

      <h2>Участники</h2>
      {failed && !data && <Notice $tone="error">Не удалось загрузить список. Проверьте соединение.</Notice>}
      {!data && !failed && <p>Загрузка…</p>}
      <Members>
        {data?.members.map((m) => (
          <MemberRow key={m.id} member={m} isMe={m.id === identity.memberId} />
        ))}
      </Members>

      <Button type="button" onClick={handleLogout}>Выйти</Button>
    </Page>
  )
}
