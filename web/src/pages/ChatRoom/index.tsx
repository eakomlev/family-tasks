import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { FAMILY_CHAT, listMessages, uploadChatPhoto, type ChatMessage, type MessageFeedback } from '@/api'
import { Avatar } from '@/components/Avatar'
import { TabIcon } from '@/components/TabBar/TabIcon'
import { MoodMark } from '@/components/MoodMark'
import { Button } from '@/components/Button'
import { Notice } from '@/components/Notice'
import { useChats } from '@/chat/context'
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
import { ChatMenu } from '../Chat/components/ChatMenu'
import { MutedMark } from '../Chat/styles'
import { Composer } from './components/Composer'
import { FeedbackDialog } from './components/FeedbackDialog'
import { MessageBubble } from './components/MessageBubble'
import { MessagesSkeleton } from './components/MessagesSkeleton'
import { PhotoViewer } from './components/PhotoViewer'
import type { OutgoingMessage } from './components/Composer/types'
import { BackButton, DayLabel, Title, Empty, Feed, FeedContent, FamilyIcon, Header, MenuButton, Room } from './styles'
import { appendMessage, groupByDay, mergeLatest, messageStatus, participantsLabel, replaceMessage, visitLabel } from './utils'

// «рядом с низом»: тогда новое сообщение прокручивает переписку само, а не сбивает чтение старых
const NEAR_BOTTOM_PX = 160

// прокручивается не страница, а лента (Feed): так открытая клавиатура не уводит поле ввода с экрана
const scrollToBottom = (feed: HTMLElement | null) => {
  if (feed) feed.scrollTop = feed.scrollHeight
}
const isNearBottom = (feed: HTMLElement | null) => !feed || feed.scrollHeight - feed.scrollTop - feed.clientHeight < NEAR_BOTTOM_PX

// Переписка: /chat/family или /chat/<id собеседника>. У каждого чата своё состояние (подгруженные страницы, прокрутка).
export default function ChatRoom() {
  const { chat } = useParams()
  return <Conversation key={chat} chat={chat} />
}

function Conversation({ chat }: { chat: string | undefined }) {
  const { identity } = useIdentity()
  const { data } = useProfile()
  const now = useNow()
  const { chats } = useChats()

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
  const [menuOpen, setMenuOpen] = useState(false)
  // открытый просмотр фото: сообщение и номер фото в нём
  const [viewing, setViewing] = useState<{ message: ChatMessage; index: number }>()
  const stick = useRef(true)
  const feedRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  // подгрузили более ранние: сколько было от текущего места до низа, чтобы после вставки сверху остаться на месте
  const keepFromBottom = useRef<number | undefined>(undefined)
  const loadedOnce = useRef(false)
  // чужое сообщение, до которого уже отметили прочитанное: без этого отметка вызывает событие, событие новый запрос, и так по кругу
  const markedRef = useRef<string | undefined>(undefined)

  const queryError = query.error
  const missing = !!queryError && 'status' in queryError && (queryError.status === 404 || queryError.status === 400)
  const failed = olderFailed || (!!queryError && !missing && !thread)

  // экран переписки встаёт на видимую область (клавиатура телефона её уменьшает)
  useKeyboardViewport()

  // Прижатость к низу помнит прокрутка самой ленты. Любое изменение размеров (клавиатура выезжает постепенно, за
  // несколько кадров; поле ввода выросло; догрузилось фото; пришло сообщение) у прижатой ленты снова ведёт к низу:
  // одной прокрутки в момент открытия клавиатуры мало, её недовыехавшая часть потом закрывала конец переписки.
  useEffect(() => {
    const feed = feedRef.current
    const content = contentRef.current
    if (!feed || !content) return
    const onScroll = () => {
      stick.current = isNearBottom(feed)
    }
    feed.addEventListener('scroll', onScroll, { passive: true })
    const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(() => stick.current && scrollToBottom(feed))
    observer?.observe(feed)
    observer?.observe(content)
    return () => {
      feed.removeEventListener('scroll', onScroll)
      observer?.disconnect()
    }
  }, [])

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
    stick.current = isNearBottom(feedRef.current) || !loadedOnce.current
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
    const feed = feedRef.current
    if (!messages || !feed) return
    if (keepFromBottom.current !== undefined) {
      feed.scrollTop = feed.scrollHeight - keepFromBottom.current
      keepFromBottom.current = undefined
    } else if (stick.current) scrollToBottom(feed)
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
      const feed = feedRef.current
      if (feed) keepFromBottom.current = feed.scrollHeight - feed.scrollTop
      setThread((current) => ({ messages: [...page.messages, ...(current?.messages ?? [])], hasMore: page.hasMore, readUpTo: current?.readUpTo ?? null }))
    } catch {
      setOlderFailed(true)
    } finally {
      setLoadingOlder(false)
    }
  }

  // загрузка одного фото для сообщения: уходит сразу после выбора, к сообщению прикрепляется при отправке
  async function handleUpload(photo: Blob) {
    const { mediaId } = await uploadChatPhoto(token!, chat!, photo)
    return mediaId
  }

  async function handleSend({ text, mediaIds }: OutgoingMessage) {
    const { message } = await sendMessage({ chat: chat!, text, mediaIds }).unwrap().catch(toApiError)
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
        {other ? <Avatar name={memberLabel(other, identity.role)} seed={other.id} src={other.avatar} size="2.25rem" /> : <FamilyIcon aria-hidden><TabIcon name="family" /></FamilyIcon>}
        <Title>
          <h1>{chatTitle(chat, members, identity.role)}{chats?.find((c) => c.id === chat)?.muted && <MutedMark aria-label="Уведомления отключены" />}{other && <> <MoodMark mood={other.mood} now={now} /></>}</h1>
          {/* под заголовком: в общем чате число участников, в личном когда собеседник был в чате */}
          {chat === FAMILY_CHAT ? participantsLabel(members.length) && <small>{participantsLabel(members.length)}</small> : visitLabel(peer, now) && <small>{visitLabel(peer, now)}</small>}
        </Title>
        <MenuButton type="button" aria-label="Меню чата" aria-haspopup="dialog" onClick={() => setMenuOpen(true)}>
          <svg viewBox="0 0 24 24" aria-hidden>
            <circle cx="12" cy="5" r="1.9" />
            <circle cx="12" cy="12" r="1.9" />
            <circle cx="12" cy="19" r="1.9" />
          </svg>
        </MenuButton>
      </Header>

      {/* лента всегда на месте (растягивается между шапкой и полем ввода): пока грузится, в ней серые пузыри, при ошибке сообщение */}
      <Feed ref={feedRef}>
        <FeedContent ref={contentRef}>
          {failed && <Notice $tone="error">Не удалось загрузить сообщения. Проверьте соединение.</Notice>}
          {!messages && !failed && <MessagesSkeleton />}
          {messages && (
            <>
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
                      onOpenPhoto={(index) => setViewing({ message, index })}
                    />
                  ))}
                </section>
              ))}
            </>
          )}
        </FeedContent>
      </Feed>

      <Composer onSend={handleSend} onUpload={handleUpload} />

      {viewing && (
        <PhotoViewer
          photos={viewing.message.media}
          index={viewing.index}
          onIndexChange={(index) => setViewing({ message: viewing.message, index })}
          onClose={() => setViewing(undefined)}
        />
      )}

      {menuOpen && <ChatMenu chat={chat} onClose={() => setMenuOpen(false)} />}

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
