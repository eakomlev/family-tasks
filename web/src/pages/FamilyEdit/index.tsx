import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useDispatch } from 'react-redux'
import { ApiError, removeMember, type Member } from '@/api'
import { Avatar } from '@/components/Avatar'
import { useConfirm } from '@/components/ConfirmDialog/context'
import { Notice } from '@/components/Notice'
import { SlideInPage as Page } from '@/components/Page'
import { PageHeader } from '@/components/PageHeader'
import { useIdentity } from '@/identity/context'
import { isAdult, ROLE_LABELS } from '@/lib/roles'
import { useInFlight } from '@/lib/useInFlight'
import { useProfile } from '@/profile/context'
import { api } from '@/store/api'
import { DeleteLink, List, Name, Row, RowButton } from './styles'

function describeError(err: unknown): string {
  if (err instanceof ApiError && err.code === 'network') return 'Нет связи с сервером. Попробуйте ещё раз.'
  if (err instanceof ApiError && err.status === 403) return 'Менять состав семьи может только её создатель.'
  if (err instanceof ApiError && err.status === 404) return 'Такого участника уже нет в семье.'
  return 'Не удалось выполнить. Попробуйте ещё раз.'
}

// Изменение семьи (только создатель): убрать взрослого из семьи, полностью удалить аккаунт ребёнка, удалить семью целиком.
// Убранный взрослый теряет всё семейное, но аккаунт остаётся (без семьи): приложение предложит ему создать семью или вступить в другую.
export default function FamilyEdit() {
  const { identity } = useIdentity()
  const { data } = useProfile()
  const guard = useInFlight()
  const confirm = useConfirm()
  const dispatch = useDispatch()
  const [busyId, setBusyId] = useState<string>()
  const [error, setError] = useState<string>()

  const remove = guard(async (member: Member) => {
    const adult = isAdult(member.role)
    const ok = await confirm(
      adult
        ? {
            title: `Убрать ${member.name} из семьи?`,
            message: 'Его личные переписки, сообщения, задания и события в этой семье пропадут. Сам аккаунт останется: при следующем открытии приложения человеку предложат создать свою семью или присоединиться к другой по ссылке.',
            confirmLabel: 'Убрать',
            danger: true,
          }
        : {
            title: `Удалить аккаунт ${member.name}?`,
            message: 'Аккаунт ребёнка будет удалён полностью: задания, расписания, монеты, цели, сообщения и личные чаты. Отменить это нельзя.',
            confirmLabel: 'Удалить',
            danger: true,
          },
    )
    if (!ok || !identity) return
    setBusyId(member.id)
    setError(undefined)
    try {
      await removeMember(identity.token, member.id)
      dispatch(api.util.invalidateTags(['Me']))
    } catch (err) {
      setError(describeError(err))
    } finally {
      setBusyId(undefined)
    }
  })

  if (!identity) return null
  // менять семью может только создатель; пока профиль не загружен, страница не прыгает
  if (data && !data.me.isOwner) return <Navigate to="/family" replace />

  const others = data?.members.filter((m) => m.id !== identity.memberId) ?? []

  return (
    <Page>
      <PageHeader to="/family">Изменить семью</PageHeader>
      <h2>Участники</h2>
      {!data && <p>Загрузка…</p>}
      {data && others.length === 0 && <Notice $tone="muted">В семье пока никого, кроме вас.</Notice>}
      <List>
        {others.map((m) => (
          <Row key={m.id}>
            <Avatar name={m.name} seed={m.id} src={m.avatar} size="2.25rem" />
            <Name>
              {m.name}
              <small>{ROLE_LABELS[m.role]}</small>
            </Name>
            <RowButton $variant="danger" type="button" disabled={busyId !== undefined} onClick={() => void remove(m)}>
              {isAdult(m.role) ? 'Убрать' : 'Удалить'}
            </RowButton>
          </Row>
        ))}
      </List>
      {error && <Notice $tone="error">{error}</Notice>}
      <DeleteLink to="/family/delete">Удалить семейный аккаунт</DeleteLink>
    </Page>
  )
}
