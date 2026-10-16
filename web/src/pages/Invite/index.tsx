import { Navigate } from 'react-router-dom'
import { BackLink } from '@/components/BackLink'
import { Page } from '@/components/Page'
import { useIdentity } from '@/identity/context'
import { useProfile } from '@/profile/context'
import { InviteByEmail } from './components/InviteByEmail'
import { InviteSection } from './components/InviteSection'

// приглашение в семью: ссылку видит и перевыпускает только создатель семьи
export default function Invite() {
  const { identity } = useIdentity()
  const { data } = useProfile()

  // остальным участникам здесь делать нечего
  if (data && !data.me.isOwner) return <Navigate to="/family" replace />

  return (
    <Page>
      <BackLink to="/family">← Моя семья</BackLink>
      <h1>Пригласить в семью</h1>
      <p>Отправьте ссылку тому, кого хотите добавить. По ней можно присоединиться как мама, папа, бабушка, дедушка или ребёнок.</p>
      {identity && data && <InviteSection token={identity.token} />}
      {identity && data && <InviteByEmail token={identity.token} />}
    </Page>
  )
}
