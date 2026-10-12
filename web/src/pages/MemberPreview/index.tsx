import { Navigate, useParams } from 'react-router-dom'
import { Avatar } from '@/components/Avatar'
import { BackLink } from '@/components/BackLink'
import { MenuLink } from '@/components/MenuLink'
import { Notice } from '@/components/Notice'
import { SlideInPage as Page } from '@/components/Page'
import { useIdentity } from '@/identity/context'
import { ageFromBirthDate, formatAge, formatBirthDate } from '@/lib/date'
import { ROLE_LABELS } from '@/lib/roles'
import { useProfile } from '@/profile/context'
import { ChildCoins } from './components/ChildCoins'
import { Badge, ChatLink, Hero } from './styles'

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
          {/* личный чат с этим человеком */}
          <ChatLink to={`/chat/${member.id}`} aria-label={`Написать: ${member.name}`} title="Написать">
            <svg viewBox="0 0 24 24" aria-hidden focusable="false">
              <path d="M5 5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-6l-5 4v-4H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z" />
              <path d="M8 10h8M8 13h5" />
            </svg>
          </ChatLink>
        </Hero>
      )}
      {/* расписания ребёнка видят и правят родители */}
      {member?.role === 'child' && identity?.role !== 'child' && (
        <>
          <ChildCoins memberId={member.id} />
          <MenuLink to={`/family/${member.id}/goals`}>Цели</MenuLink>
          <MenuLink to={`/family/${member.id}/schedule`}>Расписание уроков</MenuLink>
          <MenuLink to={`/family/${member.id}/trainings`}>Расписание тренировок</MenuLink>
        </>
      )}
    </Page>
  )
}
