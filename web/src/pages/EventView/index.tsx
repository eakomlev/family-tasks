import { useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { eventChatId } from '@/api'
import { useListChatsQuery } from '@/store/chat'
import { Avatar } from '@/components/Avatar'
import { BodyTitle, PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/Button'
import { useConfirm } from '@/components/ConfirmDialog/context'
import { Notice } from '@/components/Notice'
import { SlideInPage as Page } from '@/components/Page'
import { Stack } from '@/components/Stack'
import { useIdentity } from '@/identity/context'
import { formatDayMonth } from '@/lib/date'
import { memberLabel } from '@/lib/roles'
import { useInFlight } from '@/lib/useInFlight'
import { useProfile } from '@/profile/context'
import { toApiError } from '@/store/api'
import { useDeleteEventMutation, useGetEventQuery } from '@/store/events'
import { describeEventError } from '../EventForm/errors'
import { Details, People, Person } from './styles'

// Когда идёт событие: «7 ноября, 18:00–20:30», «10–14 ноября», «7 ноября, весь день»
function whenText(event: { startDate: string; endDate: string; startTime: string | null; endTime: string | null }): string {
  const start = formatDayMonth(event.startDate)
  if (event.startDate === event.endDate) return event.startTime ? `${start}, ${event.startTime}–${event.endTime}` : `${start}, весь день`
  const end = formatDayMonth(event.endDate)
  return event.startTime ? `${start}, ${event.startTime} — ${end}, ${event.endTime}` : `${start} — ${end}`
}

// Страница события: все детали, участники; автору «Изменить» и «Удалить»
export default function EventView() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const guard = useInFlight()
  const confirm = useConfirm()
  const { identity } = useIdentity()
  const { data: profile } = useProfile()
  const query = useGetEventQuery(id, { skip: !identity })
  const chats = useListChatsQuery().data?.chats
  const [deleteEvent] = useDeleteEventMutation()
  const [error, setError] = useState<string>()

  const event = query.data?.event
  const missing = !!query.error && 'status' in query.error && query.error.status === 404

  const remove = guard(async () => {
    if (!(await confirm({ title: 'Удалить событие?', message: 'Событие пропадёт у всех участников.', confirmLabel: 'Удалить', danger: true }))) return
    try {
      await deleteEvent(id).unwrap().catch(toApiError)
      navigate('/calendar', { replace: true })
    } catch (err) {
      setError(describeEventError(err))
    }
  })

  if (!identity) return null
  if (missing) return <Navigate to="/calendar" replace />

  const members = profile?.members ?? []
  const author = members.find((m) => m.id === event?.authorId)
  const participants = event ? (event.allFamily ? members : members.filter((m) => event.memberIds.includes(m.id) || m.id === event.authorId)) : []

  return (
    <Page>
      <PageHeader to={event ? `/calendar?date=${event.startDate}` : '/calendar'}>Событие</PageHeader>
      {!event && <p>Загрузка…</p>}
      {event && (
        <>
          <BodyTitle>{event.title}</BodyTitle>
          <Details>
            <dt>Когда</dt>
            <dd>{whenText(event)}</dd>
            <dt>Кто видит</dt>
            <dd>{event.allFamily ? 'Вся семья' : participants.length <= 1 ? 'Только автор' : 'Выбранные участники'}</dd>
            {author && (
              <>
                <dt>Автор</dt>
                <dd>{memberLabel(author, identity.role)}</dd>
              </>
            )}
          </Details>
          {participants.length > 0 && (
            <People aria-label="Участники">
              {participants.map((member) => (
                <Person key={member.id}>
                  <Avatar name={memberLabel(member, identity.role)} seed={member.id} src={member.avatar} size="2rem" />
                  {memberLabel(member, identity.role)}
                </Person>
              ))}
            </People>
          )}
          {/* у события свой чат для участников; непрочитанное видно на кнопке */}
          <Button $variant="lime" as={Link} to={`/chat/${eventChatId(event.id)}`}>
            Чат события{(chats?.find((c) => c.id === eventChatId(event.id))?.unread ?? 0) > 0 && ` (${chats!.find((c) => c.id === eventChatId(event.id))!.unread})`}
          </Button>
          {error && <Notice $tone="error">{error}</Notice>}
          {event.authorId === identity.memberId && (
            <Stack>
              <Button $variant="primary" as={Link} to={`/calendar/events/${event.id}/edit`}>
                Изменить
              </Button>
              <Button $variant="danger" type="button" onClick={remove}>
                Удалить событие
              </Button>
            </Stack>
          )}
        </>
      )}
    </Page>
  )
}
