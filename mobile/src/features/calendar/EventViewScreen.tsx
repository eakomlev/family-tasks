import { useEffect, useRef, useState } from 'react'
import { Animated, Keyboard, ScrollView, View } from 'react-native'
import PagerView from 'react-native-pager-view'
import { Redirect, useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTheme } from 'styled-components/native'
import { Avatar } from '@/components/Avatar'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/Button'
import { PillTabs, type PillTab } from '@/components/PillTabs'
import { TOP_CORNER } from '@/components/Screen'
import { Stack } from '@/components/Stack'
import { Text } from '@/components/Text'
import { eventChatId } from '@/api'
import { useChats } from '@/chat/context'
import { ChatRoomScreen } from '@/features/chat/ChatRoomScreen'
import { useIdentity } from '@/identity/context'
import { formatDayMonth } from '@/lib/date'
import { memberLabel } from '@/lib/roles'
import { useProfile } from '@/profile/context'
import { useGetEventQuery } from '@/store/events'

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

const TABS: PillTab[] = [
  { key: 'event', label: 'Событие', icon: 'calendar-outline' },
  { key: 'chat', label: 'Чат', icon: 'chatbubbles-outline' },
]

// Страница события: две вкладки внизу. «Событие» (по умолчанию): все детали и участники, автору «Изменить» справа сверху и «Удалить».
// «Чат»: переписка участников события; в списке чатов она появляется после первого сообщения. Вкладки листаются пальцем.
export function EventViewScreen({ id, tab }: { id: string; tab?: string }) {
  const router = useRouter()
  const { colors } = useTheme()
  const insets = useSafeAreaInsets()
  const { identity } = useIdentity()
  const { data: profile } = useProfile()
  const { chats } = useChats()
  const query = useGetEventQuery(id, { skip: !identity })

  // страницы: «Событие» и «Чат»; нижняя панель следует за листанием
  const pager = useRef<PagerView>(null)
  const startIndex = tab === 'chat' ? 1 : 0
  const [index, setIndex] = useState(startIndex)
  const position = useRef(new Animated.Value(startIndex)).current
  // пока клавиатура открыта, нижняя панель вкладок прячется: поле ввода стоит прямо над клавиатурой
  const [keyboard, setKeyboard] = useState(false)
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => setKeyboard(true))
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboard(false))
    return () => {
      show.remove()
      hide.remove()
    }
  }, [])

  const event = query.data?.event
  const missing = !!query.error && 'status' in query.error && query.error.status === 404
  const chatId = eventChatId(id)
  const unread = chats?.find((c) => c.id === chatId)?.unread ?? 0

  // удаление подтверждается на отдельной странице: там сказано, что вместе с событием уйдёт и его чат
  const remove = () => router.push({ pathname: '/calendar/events/[id]/delete', params: { id } })

  if (!identity) return null
  if (missing) return <Redirect href="/calendar" />

  const members = profile?.members ?? []
  const author = members.find((m) => m.id === event?.authorId)
  const participants = event ? (event.allFamily ? members : members.filter((m) => event.memberIds.includes(m.id) || m.id === event.authorId)) : []
  const isAuthor = !!event && event.authorId === identity.memberId

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top + TOP_CORNER }}>
      <View style={{ paddingHorizontal: 20, paddingBottom: 6 }}>
        <PageHeader
          fallback={event ? { pathname: '/calendar', params: { date: event.startDate } } : '/calendar'}
          right={
            isAuthor ? (
              <Button variant="text" onPress={() => router.push({ pathname: '/calendar/events/[id]/edit', params: { id } })}>
                Изменить
              </Button>
            ) : undefined
          }
        >
          {event?.title ?? ''}
        </PageHeader>
      </View>

      <PagerView
        ref={pager}
        style={{ flex: 1 }}
        initialPage={startIndex}
        onPageScroll={(e) => position.setValue(e.nativeEvent.position + e.nativeEvent.offset)}
        onPageSelected={(e) => setIndex(e.nativeEvent.position)}
      >
        <View key="event" style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={{ gap: 16, padding: 20, paddingTop: 8 }} keyboardShouldPersistTaps="handled">
            {!event && <Text $tone="muted">Загрузка…</Text>}
            {event && (
              <>
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
                {isAuthor && (
                  <Button variant="danger" onPress={remove}>
                    Удалить событие
                  </Button>
                )}
              </>
            )}
          </ScrollView>
        </View>

        <View key="chat" style={{ flex: 1 }}>
          {event && <ChatRoomScreen chat={chatId} embedded active={index === 1} eventTitle={event.title} />}
        </View>
      </PagerView>

      {!keyboard && (
        <View style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: insets.bottom + 12 }}>
          <PillTabs tabs={TABS.map((t) => (t.key === 'chat' && index !== 1 ? { ...t, badge: unread } : t))} index={index} position={position} onPress={(i) => pager.current?.setPage(i)} />
        </View>
      )}
    </View>
  )
}
