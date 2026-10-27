import { Navigate } from 'react-router-dom'
import { MenuLink } from '@/components/MenuLink'
import { Notice } from '@/components/Notice'
import { Page } from '@/components/Page'
import { useIdentity } from '@/identity/context'
import { MAX_FAMILY_MEMBERS, ROLE_LABELS } from '@/lib/roles'
import { useProfile } from '@/profile/context'
import { MemberRow } from './components/MemberRow'
import { EditLink, Head, Members } from './styles'

export default function Family() {
  const { identity } = useIdentity()
  const { data, failed } = useProfile()

  if (!identity) return <Navigate to="/" replace />

  return (
    <Page>
      <Head>
        <h1>Ваша семья</h1>
        {/* менять состав семьи и удалять её может только создатель */}
        {data?.me.isOwner && <EditLink to="/family/edit">Изменить</EditLink>}
      </Head>
      {identity.role !== 'child' && <p>Вы вошли как <strong>{identity.name}</strong> ({ROLE_LABELS[identity.role]}). Код семьи: <code>{identity.familyCode}</code></p>}

      <h2>Участники{data && ` (${data.members.length} из ${MAX_FAMILY_MEMBERS})`}</h2>
      {failed && !data && <Notice $tone="error">Не удалось загрузить список. Проверьте соединение.</Notice>}
      {!data && !failed && <p>Загрузка…</p>}
      <Members>
        {data?.members.map((m) => (
          <MemberRow key={m.id} member={m} isMe={m.id === identity.memberId} />
        ))}
      </Members>

      {data?.me.isOwner && data.members.length < MAX_FAMILY_MEMBERS && <MenuLink to="/family/invite">Пригласить</MenuLink>}
      {data?.me.isOwner && data.members.length >= MAX_FAMILY_MEMBERS && <Notice $tone="muted">В семье максимум участников ({MAX_FAMILY_MEMBERS}), пригласить ещё кого-то нельзя.</Notice>}
    </Page>
  )
}
