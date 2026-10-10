import { Navigate, useParams } from 'react-router-dom'
import { Avatar } from '@/components/Avatar'
import { BackLink } from '@/components/BackLink'
import { MenuLink } from '@/components/MenuLink'
import { Notice } from '@/components/Notice'
import { Page } from '@/components/Page'
import { useIdentity } from '@/identity/context'
import { ageFromBirthDate, formatAge, formatBirthDate } from '@/lib/date'
import { ROLE_LABELS } from '@/lib/roles'
import { useProfile } from '@/profile/context'
import { Badge, Hero } from './styles'

// краткая карточка другого участника семьи (только просмотр)
export default function MemberPreview() {
  const { memberId } = useParams()
  const { identity } = useIdentity()
  const { data, failed } = useProfile()

  // свой профиль открывается на странице редактирования
  if (memberId === identity?.memberId) return <Navigate to="/profile" replace />

  const member = data?.members.find((m) => m.id === memberId)
  // участника нет в семье (например, неверная ссылка)
  if (data && !member) return <Navigate to="/family" replace />

  return (
    <Page>
      <BackLink to="/family">← Моя семья</BackLink>
      {!member && failed && <Notice $tone="error">Не удалось загрузить участника. Проверьте соединение.</Notice>}
      {!member && !failed && <p>Загрузка…</p>}
      {member && (
        <Hero>
          <Avatar name={member.name} seed={member.id} src={member.avatar} size="7rem" />
          <h1>{member.name}</h1>
          <Badge>{ROLE_LABELS[member.role]}{member.isOwner && ' · создатель семьи'}</Badge>
          {member.birthDate && (
            <Notice $tone="muted">
              {formatBirthDate(member.birthDate)} · {formatAge(ageFromBirthDate(member.birthDate))}
            </Notice>
          )}
        </Hero>
      )}
      {/* расписание ребёнка видят и правят родители */}
      {member?.role === 'child' && identity?.role !== 'child' && (
        <MenuLink to={`/family/${member.id}/schedule`}>Расписание уроков</MenuLink>
      )}
    </Page>
  )
}
