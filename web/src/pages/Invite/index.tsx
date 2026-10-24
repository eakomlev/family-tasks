import { Navigate } from 'react-router-dom'
import { PageHeader } from '@/components/PageHeader'
import { Page } from '@/components/Page'
import { useIdentity } from '@/identity/context'
import { useProfile } from '@/profile/context'
import { InviteByEmail } from './components/InviteByEmail'
import { InviteSection } from './components/InviteSection'
import { Card } from './styles'

// приглашение в семью: ссылку видит и перевыпускает только создатель семьи
export default function Invite() {
  const { identity } = useIdentity()
  const { data } = useProfile()

  // остальным участникам здесь делать нечего
  if (data && !data.me.isOwner) return <Navigate to="/family" replace />

  return (
    <Page>
      <PageHeader to="/family">Пригласить в семью</PageHeader>
      <p>По приглашению можно присоединиться как мама, папа, бабушка, дедушка или ребёнок.</p>
      {identity && data && (
        <>
          <Card>
            <InviteByEmail token={identity.token} />
          </Card>
          <Card>
            <h2>Отправить ссылку вручную</h2>
            <p>Скопируйте ссылку или поделитесь ею в любом мессенджере.</p>
            <InviteSection token={identity.token} />
          </Card>
        </>
      )}
    </Page>
  )
}
