import { useState } from 'react'
import { View } from 'react-native'
import { Redirect, useRouter } from 'expo-router'
import { Avatar } from '@/components/Avatar'
import { BackLink } from '@/components/BackLink'
import { Button } from '@/components/Button'
import { useConfirm } from '@/components/ConfirmDialog'
import { Notice } from '@/components/Notice'
import { Screen } from '@/components/Screen'
import { Stack } from '@/components/Stack'
import { Text, Title } from '@/components/Text'
import { useIdentity } from '@/identity/context'
import { formatDayMonth } from '@/lib/date'
import { memberLabel } from '@/lib/roles'
import { useInFlight } from '@/lib/useInFlight'
import { useProfile } from '@/profile/context'
import { toApiError } from '@/store/api'
import { useDeleteEventMutation, useGetEventQuery } from '@/store/events'
import { describeEventError } from './eventErrors'

// Когда идёт событие: «7 ноября, 18:00–20:30», «10–14 ноября», «7 ноября, весь день»
function whenText(event: { startDate: string; endDate: string; startTime: string | null; endTime: string | null }): string {
  const start = formatDayMonth(event.startDate)
  if (event.startDate === event.endDate) return event.startTime ? `${start}, ${event.startTime}–${event.endTime}` : `${start}, весь день`
  const end = formatDayMonth(event.endDate)
  return event.startTime ? `${start}, ${event.startTime} — ${end}, ${event.endTime}` : `${start} — ${end}`
}

function Row({ label, children }: { label: string; children: string }) {
  return (
    <View style={{ flexDirection: 'row', gap: 12 }}>
      <Text $tone="muted" style={{ width: 90 }}>
        {label}
      </Text>
      <Text style={{ flex: 1 }}>{children}</Text>
    </View>
  )
}

// Страница события: все детали, участники; автору «Изменить» и «Удалить»
export function EventViewScreen({ id }: { id: string }) {
  const router = useRouter()
  const guard = useInFlight()
  const confirm = useConfirm()
  const { identity } = useIdentity()
  const { data: profile } = useProfile()
  const query = useGetEventQuery(id, { skip: !identity })
  const [deleteEvent] = useDeleteEventMutation()
  const [error, setError] = useState<string>()

  const event = query.data?.event
  const missing = !!query.error && 'status' in query.error && query.error.status === 404

  const remove = guard(async () => {
    if (!(await confirm({ title: 'Удалить событие?', message: 'Событие пропадёт у всех участников.', confirmLabel: 'Удалить', danger: true }))) return
    try {
      await deleteEvent(id).unwrap().catch(toApiError)
      router.replace('/calendar')
    } catch (err) {
      setError(describeEventError(err))
    }
  })

  if (!identity) return null
  if (missing) return <Redirect href="/calendar" />

  const members = profile?.members ?? []
  const author = members.find((m) => m.id === event?.authorId)
  const participants = event ? (event.allFamily ? members : members.filter((m) => event.memberIds.includes(m.id) || m.id === event.authorId)) : []

  return (
    <Screen bottomReserve={88}>
      <BackLink fallback={event ? { pathname: '/calendar', params: { date: event.startDate } } : '/calendar'}>← Календарь</BackLink>
      {!event && <Text $tone="muted">Загрузка…</Text>}
      {event && (
        <>
          <Title>{event.title}</Title>
          <Stack $gap={8}>
            <Row label="Когда">{whenText(event)}</Row>
            <Row label="Кто видит">{event.allFamily ? 'Вся семья' : participants.length <= 1 ? 'Только автор' : 'Выбранные участники'}</Row>
            {author && <Row label="Автор">{memberLabel(author, identity.role)}</Row>}
          </Stack>
          {participants.length > 0 && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }} accessibilityLabel="Участники">
              {participants.map((member) => (
                <View key={member.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Avatar name={memberLabel(member, identity.role)} seed={member.id} src={member.avatar} size={32} />
                  <Text>{memberLabel(member, identity.role)}</Text>
                </View>
              ))}
            </View>
          )}
          {error && <Notice tone="error">{error}</Notice>}
          {event.authorId === identity.memberId && (
            <Stack $gap={8}>
              <Button variant="primary" onPress={() => router.push({ pathname: '/calendar/events/[id]/edit', params: { id: event.id } })}>
                Изменить
              </Button>
              <Button variant="danger" onPress={remove}>
                Удалить событие
              </Button>
            </Stack>
          )}
        </>
      )}
    </Screen>
  )
}
