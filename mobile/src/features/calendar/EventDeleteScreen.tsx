import { useState } from 'react'
import { Redirect, useRouter } from 'expo-router'
import { Button } from '@/components/Button'
import { Notice } from '@/components/Notice'
import { PageHeader } from '@/components/PageHeader'
import { Screen } from '@/components/Screen'
import { Stack } from '@/components/Stack'
import { Heading, Text } from '@/components/Text'
import { useIdentity } from '@/identity/context'
import { goBack } from '@/lib/navigation'
import { useInFlight } from '@/lib/useInFlight'
import { toApiError } from '@/store/api'
import { useDeleteEventMutation, useGetEventQuery } from '@/store/events'
import { describeEventError } from './eventErrors'

// Подтверждение удаления события (только автор): объясняем, что вместе с событием исчезнет его чат со всеми сообщениями.
export function EventDeleteScreen({ id }: { id: string }) {
  const router = useRouter()
  const guard = useInFlight()
  const { identity } = useIdentity()
  const query = useGetEventQuery(id, { skip: !identity })
  const [deleteEvent, { isLoading }] = useDeleteEventMutation()
  const [error, setError] = useState<string>()

  const event = query.data?.event
  const missing = !!query.error && 'status' in query.error && query.error.status === 404

  const remove = guard(async () => {
    setError(undefined)
    try {
      await deleteEvent(id).unwrap().catch(toApiError)
      router.dismissTo('/calendar')
    } catch (err) {
      setError(describeEventError(err))
    }
  })

  if (!identity) return null
  if (missing) return <Redirect href="/calendar" />
  // удалять может только автор
  if (event && event.authorId !== identity.memberId) return <Redirect href={{ pathname: '/calendar/events/[id]', params: { id } }} />

  return (
    <Screen header={<PageHeader fallback={{ pathname: '/calendar/events/[id]', params: { id } }}>Удаление события</PageHeader>}>
      {!event && <Text $tone="muted">Загрузка…</Text>}
      {event && (
        <>
          <Stack $gap={8}>
            <Heading>{`Удалить «${event.title}»?`}</Heading>
            <Text>Событие пропадёт из календаря у всех участников.</Text>
          </Stack>
          <Notice tone="warning">Вместе с событием будет удалён его чат: все сообщения, фото и файлы в нём пропадут у всех участников. Отменить это нельзя.</Notice>
          {error && <Notice tone="error">{error}</Notice>}
          <Stack $gap={8}>
            <Button variant="danger" disabled={isLoading} onPress={remove}>
              Удалить событие и чат
            </Button>
            <Button disabled={isLoading} onPress={() => goBack(router, { pathname: '/calendar/events/[id]', params: { id } })}>
              Отмена
            </Button>
          </Stack>
        </>
      )}
    </Screen>
  )
}
