import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { FAMILY_CHAT, listMessages, type ChatMessage, type MessageFeedback } from '@/api'
import { Avatar } from '@/components/Avatar'
import { MoodMark } from '@/components/MoodMark'
import { Button } from '@/components/Button'
import { Notice } from '@/components/Notice'
import { useIdentity } from '@/identity/context'
import { useKeyboardViewport } from '@/lib/useKeyboardViewport'
import { useNow } from '@/lib/useNow'
import { useProfile } from '@/profile/context'
import { useViewingChat } from '@/realtime/context'
import { toApiError } from '@/store/api'
import { useGetMessagesQuery, useGiveFeedbackMutation, useMarkChatReadMutation, useSendMessageMutation } from '@/store/chat'
import { currentMood } from '@/lib/mood'
import { memberLabel } from '@/lib/roles'
import { chatTitle } from '../Chat/utils'
import { Composer } from './components/Composer'
import { FeedbackDialog } from './components/FeedbackDialog'
import { MessageBubble } from './components/MessageBubble'
import { BackButton, DayLabel, Title, Empty, Feed, FamilyIcon, Header, Room } from './styles'
import { appendMessage, groupByDay, mergeLatest, messageStatus, replaceMessage, visitLabel } from './utils'

// «рядом с низом»: тогда новое сообщение прокручивает переписку само, а не сбивает чтение старых
const NEAR_BOTTOM_PX = 160

const scrollToBottom = () => window.scrollTo({ top: document.documentElement.scrollHeight })
const isNearBottom = () => document.documentElement.scrollHeight - window.scrollY - window.innerHeight < NEAR_BOTTOM_PX

// Переписка: /chat/family или /chat/<id собеседника>. У каждого чата своё состояние (подгруженные страницы, прокрутка).
export default function ChatRoom() {
  const { chat } = useParams()
  return <Conversation key={chat} chat={chat} />
}

function Conversation({ chat }: { chat: string | undefined }) {
  const { identity } = useIdentity()
  const { data } = useProfile()
  const now = useNow()

  const token = identity?.token
  const me = identity?.memberId
  const members = data?.members ?? []

  // Свежая первая страница из кэша: сохранённая на устройстве видна сразу, свежая приходит следом, а по сигналу сокета
  // кэш сбрасывается и страница запрашивается заново. Более старые страницы подгружает сам экран и держит у себя.
  const query = useGetMessagesQuery(chat ?? '', { skip: !token || !chat })
  const page = query.data
  const [sendMessage] = useSendMessageMutation()
  const [giveFeedback] = useGiveFeedbackMutation()
  const [markChatRead] = useMarkChatReadMutation()

  // загруженная переписка: старые сверху; hasMore — есть ли ещё более старые (с первого кадра из кэша, если он есть)
  const [thread, setThread] = useState<{ messages: ChatMessage[]; hasMore: boolean; readUpTo: string | null } | undefined>(
    () => page && { messages: page.messages, hasMore: page.hasMore, readUpTo: page.readUpTo },
  )
  const peer = page?.peer ?? null
  const messages = thread?.messages
  const hasMore = thread?.hasMore ?? false
  const [olderFailed, setOlderFailed] = useState(false)
  const [loadingOlder, setLoadingOlder] = useState(false)
  // сообщение ребёнка, над которым родитель открыл окно реакции и монет
  const [feedbackFor, setFeedbackFor] = useState<ChatMessage>()
  const stick = useRef(true)
  const loadedOnce = useRef(false)
  // чужое сообщение, до которого уже отметили прочитанное: без этого отметка вызывает событие, событие новый запрос, и так по кругу
  const markedRef = useRef<string | undefined>(undefined)

  const queryError = query.error
  const missing = !!queryError && 'status' in queryError && (queryError.status === 404 || queryError.status === 400)
  const failed = olderFailed || (!!queryError && !missing && !thread)

  // клавиатура телефона меняет видимую область: переписка остаётся прижатой к низу, если читатель и так внизу
  useKeyboardViewport(() => {
    if (stick.current) scrollToBottom()
  })

  // пока чат открыт, пуши о его сообщениях не нужны
  useViewingChat(chat)

  // Прочитано: список чатов и значок на табе обновятся сами (мутация сбрасывает кэш списка чатов).
  const markRead = useCallback(async () => {
    if (!chat) return
    try {
      await markChatRead(chat).unwrap()
    } catch {
      /* не критично: отметка повторится при следующем сообщении */
    }
  }, [chat, markChatRead])

  // пришла первая страница (из сети или после сигнала сокета): сливаем с уже подгруженными старыми сообщениями
  useEffect(() => {
    if (!page || !chat) return
    stick.current = isNearBottom() || !loadedOnce.current
    loadedOnce.current = true
    // oxlint-disable-next-line react/set-state-in-effect -- сливаем пришедшую страницу с уже подгруженными старыми сообщениями
    setThread((current) => ({
      ...mergeLatest(current?.messages ?? [], page.messages, page.hasMore, current?.hasMore ?? false),
      readUpTo: page.readUpTo,
    }))
    setOlderFailed(false)
    // без findLast: он есть не во всех версиях Safari
    const newest = [...page.messages].reverse().find((m) => m.senderId !== me)
    if (newest && markedRef.current !== `${chat}:${newest.id}`) {
      markedRef.current = `${chat}:${newest.id}`
      void markRead()
    }
  }, [page, chat, me, markRead])

  // вернулись на вкладку: пока читали что-то другое, могли прийти сообщения
  useEffect(() => {
    const onVisible = () => document.visibilityState === 'visible' && void markRead()
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [markRead])

  // новые сообщения: к низу, если читатель и так был внизу (или только что открыл чат)
  useLayoutEffect(() => {
    if (messages && stick.current) scrollToBottom()
  }, [messages])

  if (!chat || !identity || !me) return null
  if (missing) return <Navigate to="/chat" replace />

  const other = chat === FAMILY_CHAT ? undefined : members.find((m) => m.id === chat)
  // подпись автора в общем чате: ребёнок видит родителей как «Мама» и «Папа»
  const sender = (id: string) => {
    const member = members.find((m) => m.id === id)
    return member && memberLabel(member, identity.role)
  }

  async function loadOlder() {
    if (!token || !chat || !messages?.length) return
    setLoadingOlder(true)
    try {
      const page = await listMessages(token, chat, messages[0].id)
      stick.current = false
      setThread((current) => ({ messages: [...page.messages, ...(current?.messages ?? [])], hasMore: page.hasMore, readUpTo: current?.readUpTo ?? null }))
    } catch {
      setOlderFailed(true)
    } finally {
      setLoadingOlder(false)
    }
  }

  async function handleSend(text: string) {
    const { message } = await sendMessage({ chat: chat!, text }).unwrap().catch(toApiError)
    stick.current = true
    setThread((current) => ({ messages: appendMessage(current?.messages ?? [], message), hasMore: current?.hasMore ?? false, readUpTo: current?.readUpTo ?? null }))
  }

  // Реакцию можно поставить на любое сообщение, а монеты начисляют только родители и только за сообщения детей.
  const canAward = (message: ChatMessage) =>
    identity!.role !== 'child' && members.find((m) => m.id === message.senderId)?.role === 'child'

  async function handleFeedback(feedback: MessageFeedback) {
    const target = feedbackFor
    if (!target) return
    const { message } = await giveFeedback({ chat: chat!, messageId: target.id, feedback }).unwrap().catch(toApiError)
    setThread((current) => current && { ...current, messages: replaceMessage(current.messages, message) })
    setFeedbackFor(undefined)
    // монеты изменили баланс, а список чатов не меняется; профиль обновит сигнал сервера
  }

  const groups = messages ? groupByDay(messages, now) : []

  return (
    <Room>
      <Header>
        <BackButton to="/chat" aria-label="К списку чатов">
          <svg viewBox="0 0 24 24" aria-hidden>
            <path d="M15 5l-7 7 7 7" />
          </svg>
        </BackButton>
        {other ? <Avatar name={memberLabel(other, identity.role)} seed={other.id} src={other.avatar} size="2.25rem" /> : <FamilyIcon aria-hidden>👨‍👩‍👧</FamilyIcon>}
        <Title>
          <h1>{chatTitle(chat, members, identity.role)}{other && <> <MoodMark mood={other.mood} now={now} /></>}</h1>
          {visitLabel(peer, now) && <small>{visitLabel(peer, now)}</small>}
        </Title>
      </Header>

      {failed && <Notice $tone="error">Не удалось загрузить сообщения. Проверьте соединение.</Notice>}
      {!messages && !failed && <p>Загрузка…</p>}

      {messages && (
        <Feed>
          {hasMore && (
            <Button $variant="text" type="button" disabled={loadingOlder} onClick={loadOlder}>
              {loadingOlder ? 'Загрузка…' : 'Показать более ранние'}
            </Button>
          )}
          {messages.length === 0 && <Empty>Сообщений пока нет. Напишите первым.</Empty>}
          {groups.map((group) => (
            <section key={group.key} aria-label={group.label}>
              <DayLabel>{group.label}</DayLabel>
              {group.messages.map((message) => (
                <MessageBubble
                  key={message.id}
                  message={message}
                  mine={message.senderId === me}
                  senderName={sender(message.senderId)}
                  senderMood={currentMood(members.find((m) => m.id === message.senderId)?.mood, now)?.emoji}
                  showSender={chat === FAMILY_CHAT}
                  status={message.senderId === me ? messageStatus(message, thread?.readUpTo ?? null) : undefined}
                  onFeedback={() => setFeedbackFor(message)}
                />
              ))}
            </section>
          ))}
        </Feed>
      )}

      <Composer onSend={handleSend} />

      {feedbackFor && (
        <FeedbackDialog
          message={feedbackFor}
          authorName={sender(feedbackFor.senderId) ?? 'Участник'}
          canAward={canAward(feedbackFor)}
          myEmoji={feedbackFor.reactions.find((r) => r.memberId === me)?.emoji}
          onSubmit={handleFeedback}
          onClose={() => setFeedbackFor(undefined)}
        />
      )}
    </Room>
  )
}
