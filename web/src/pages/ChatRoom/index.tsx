import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Navigate, useLocation, useParams, useSearchParams } from 'react-router-dom'
import { FAMILY_CHAT, isEventChat, listMessages, uploadChatFile, uploadChatPhoto, type ChatMessage, type MessageFeedback } from '@/api'
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
import { PillTabs } from '@/components/PillTabs'
import { playSendFeedback } from '@/lib/sendFeedback'
import { useGetEventQuery } from '@/store/events'
import { useDeleteMessageMutation, useEditMessageMutation, useGetMessagesQuery, useGiveFeedbackMutation, useMarkChatReadMutation, useSendMessageMutation } from '@/store/chat'
import { currentMood } from '@/lib/mood'
import { isParent, memberLabel } from '@/lib/roles'
import { retryRead } from '@/lib/retry'
import { useAbortOnUnmount } from '@/lib/useAbortOnUnmount'
import { useSlideIn } from '@/lib/useSlideIn'
import { chatTitle } from '../Chat/utils'
import { ChatMenu } from '../Chat/components/ChatMenu'
import { MutedMark } from '../Chat/styles'
import { Composer } from './components/Composer'
import { FeedbackDialog } from './components/FeedbackDialog'
import { MessageBubble } from './components/MessageBubble'
import { MessagesSkeleton } from './components/MessagesSkeleton'
import { PendingMessages, type PendingMessage } from './components/PendingMessages'
import { PhotoViewer } from './components/PhotoViewer'
import type { OutgoingMessage } from './components/Composer/types'
import { BackButton, DayLabel, Title, Empty, Feed, FeedContent, FamilyIcon, Header, MenuButton, Room, WhoLink } from './styles'
import { appendMessage, groupByDay, mergeLatest, messageStatus, participantsLabel, replaceMessage, visitLabel } from './utils'

// «рядом с низом»: тогда новое сообщение прокручивает переписку само, а не сбивает чтение старых
const NEAR_BOTTOM_PX = 160

// прокручивается не страница, а лента (Feed): так открытая клавиатура не уводит поле ввода с экрана
const scrollToBottom = (feed: HTMLElement | null) => {
  if (feed) feed.scrollTop = feed.scrollHeight
}
const isNearBottom = (feed: HTMLElement | null) => !feed || feed.scrollHeight - feed.scrollTop - feed.clientHeight < NEAR_BOTTOM_PX

// Выдержка из сообщения для ответа: текст или, у сообщения только с вложениями, заглушка
const replyPreview = (message: ChatMessage) => (message.caption || message.text).replace(/\s+/g, ' ').trim().slice(0, 140)

// Переписка: /chat/family или /chat/<id собеседника>. У каждого чата своё состояние (подгруженные страницы, прокрутка).
export default function ChatRoom() {
  const { chat } = useParams()
  return <Conversation key={chat} chat={chat} />
}

function Conversation({ chat }: { chat: string | undefined }) {
  const { identity } = useIdentity()
  // переписка выезжает справа только при переходе вперёд
  const slideIn = useSlideIn()
  const abort = useAbortOnUnmount()
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
  const [editMessage] = useEditMessageMutation()
  const [deleteMessage] = useDeleteMessageMutation()
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
  // на какое сообщение отвечаем и какое правим (одновременно только одно из двух)
  const [replyingTo, setReplyingTo] = useState<ChatMessage>()
  const [editing, setEditing] = useState<ChatMessage>()
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

  // Переход из поиска (?message=<id>): подгружаем более ранние страницы, пока сообщение не найдётся, и прокручиваем к нему с подсветкой.
  const [search, setSearch] = useSearchParams()
  const target = search.get('message')
  const jumping = useRef(false)
  useEffect(() => {
    if (!target || !messages || !token || !chat) return
    const feed = feedRef.current
    if (messages.some((m) => m.id === target)) {
      stick.current = false
      const el = feed?.querySelector<HTMLElement>(`[data-message-id="${CSS.escape(target)}"]`)
      el?.scrollIntoView({ block: 'center' })
      el?.setAttribute('data-found', '')
      if (el) setTimeout(() => el.removeAttribute('data-found'), 2000)
      setSearch({}, { replace: true })
    } else if (hasMore && !jumping.current) {
      jumping.current = true
      stick.current = false
      retryRead(() => listMessages(token, chat, messages[0].id), abort.current?.signal)
        .then((older) => setThread((current) => ({ messages: [...older.messages, ...(current?.messages ?? [])], hasMore: older.hasMore, readUpTo: current?.readUpTo ?? null })))
        .catch(() => setOlderFailed(true))
        .finally(() => {
          jumping.current = false
        })
    } else if (!hasMore) {
      // сообщения нет (удалено): остаёмся в переписке
      setSearch({}, { replace: true })
    }
  }, [target, messages, hasMore, token, chat, abort, setSearch])

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

  // чат события: название берём из списка чатов, а у ещё пустого чата из самого события
  const eventId = chat && isEventChat(chat) ? chat.slice('event-'.length) : undefined
  const eventQuery = useGetEventQuery(eventId ?? '', { skip: !eventId })

  // текст, переданный через «Поделиться»
  const sharedText = (useLocation().state as { share?: string } | null)?.share

  // мои сообщения, которые уходят или не ушли: показываются в ленте сразу
  const [pending, setPending] = useState<PendingMessage[]>([])

  if (!chat || !identity || !me) return null
  if (missing) return <Navigate to="/chat" replace />

  const other = chat === FAMILY_CHAT || eventId ? undefined : members.find((m) => m.id === chat)
  const eventTitle = eventId ? (chats?.find((c) => c.id === chat)?.event?.title ?? eventQuery.data?.event.title ?? 'Событие') : undefined
  // подпись автора в общем чате: ребёнок видит родителей как «Мама» и «Папа»
  const sender = (id: string) => {
    const member = members.find((m) => m.id === id)
    return member && memberLabel(member, identity.role)
  }

  async function loadOlder() {
    if (!token || !chat || !messages?.length) return
    setLoadingOlder(true)
    try {
      const page = await retryRead(() => listMessages(token, chat, messages[0].id), abort.current?.signal)
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

  // загрузка одного файла (не фото) для сообщения
  async function handleUploadFile(file: File) {
    const { fileId } = await uploadChatFile(token!, chat!, file)
    return fileId
  }

  // Отправка мгновенная: сообщение сразу в ленте, уходит в фоне; не удалось — остаётся с «Отправить ещё раз» и «Удалить».
  // Вложения уже загружены, поэтому повтор их заново не грузит.
  async function deliver(item: PendingMessage) {
    setPending((list) => list.map((p) => (p.key === item.key ? { ...p, status: 'sending' } : p)))
    try {
      const { message } = await sendMessage({ chat: chat!, text: item.text, mediaIds: item.mediaIds, fileIds: item.fileIds, replyTo: item.replyTo }).unwrap().catch(toApiError)
      stick.current = true
      setThread((current) => ({ messages: appendMessage(current?.messages ?? [], message), hasMore: current?.hasMore ?? false, readUpTo: current?.readUpTo ?? null }))
      setPending((list) => list.filter((p) => p.key !== item.key))
    } catch {
      setPending((list) => list.map((p) => (p.key === item.key ? { ...p, status: 'failed' } : p)))
    }
  }

  async function handleSend({ text, mediaIds, fileIds }: OutgoingMessage) {
    const item: PendingMessage = { key: `pending-${Date.now()}-${Math.random().toString(36).slice(2)}`, text, mediaIds, fileIds, replyTo: replyingTo?.id, status: 'sending' }
    setPending((list) => [...list, item])
    setReplyingTo(undefined)
    stick.current = true
    playSendFeedback()
    void deliver(item)
  }

  // Реакцию можно поставить на любое сообщение, а монеты начисляют только родители (мама, папа) и только за сообщения детей.
  const canAward = (message: ChatMessage) =>
    isParent(identity!.role) && members.find((m) => m.id === message.senderId)?.role === 'child'

  async function handleFeedback(feedback: MessageFeedback) {
    const target = feedbackFor
    if (!target) return
    const { message } = await giveFeedback({ chat: chat!, messageId: target.id, feedback }).unwrap().catch(toApiError)
    setThread((current) => current && { ...current, messages: replaceMessage(current.messages, message) })
    setFeedbackFor(undefined)
    // монеты изменили баланс, а список чатов не меняется; профиль обновит сигнал сервера
  }

  async function handleEdit(text: string) {
    if (!editing) return
    const { message } = await editMessage({ chat: chat!, messageId: editing.id, text }).unwrap().catch(toApiError)
    setThread((current) => current && { ...current, messages: replaceMessage(current.messages, message) })
    setEditing(undefined)
  }

  async function handleDelete() {
    const target = feedbackFor
    if (!target) return
    await deleteMessage({ chat: chat!, messageId: target.id }).unwrap().catch(toApiError)
    setThread((current) => current && { ...current, messages: current.messages.filter((m) => m.id !== target.id) })
    setFeedbackFor(undefined)
  }

  const groups = messages ? groupByDay(messages, now) : []

  const who = (
    <>
      {other ? (
        <Avatar name={memberLabel(other, identity.role)} seed={other.id} src={other.avatar} size="2.25rem" />
      ) : eventId ? (
        <FamilyIcon aria-hidden>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="4" y="5.5" width="16" height="14" rx="2.5" />
            <path d="M4 10h16M9 3.5v4M15 3.5v4" />
          </svg>
        </FamilyIcon>
      ) : (
        <FamilyIcon aria-hidden><TabIcon name="family" /></FamilyIcon>
      )}
      <Title>
        <h1>{chatTitle(chat, members, identity.role, eventTitle)}{chats?.find((c) => c.id === chat)?.muted && <MutedMark aria-label="Уведомления отключены" />}{other && <> <MoodMark mood={other.mood} now={now} /></>}</h1>
        {/* под заголовком: в общем чате число участников, в личном когда собеседник был в чате */}
        {eventId ? <small>Чат события</small> : chat === FAMILY_CHAT ? participantsLabel(members.length) && <small>{participantsLabel(members.length)}</small> : visitLabel(peer, now) && <small>{visitLabel(peer, now)}</small>}
      </Title>
    </>
  )

  return (
    <Room $slide={slideIn}>
      <Header>
        <BackButton to={eventId ? '/calendar' : '/chat'} aria-label={eventId ? 'К календарю' : 'К списку чатов'}>
          <svg viewBox="0 0 24 24" aria-hidden>
            <path d="M15 5l-7 7 7 7" />
          </svg>
        </BackButton>
        {/* аватар и имя собеседника: нажатие открывает его профиль (в общем чате это просто подпись) */}
        <WhoLink to={`/chat/${chat}/info`} aria-label="Информация о чате">{who}</WhoLink>
        <MenuButton type="button" aria-label="Меню чата" aria-haspopup="dialog" onClick={() => setMenuOpen(true)}>
          <svg viewBox="0 0 24 24" aria-hidden>
            <circle cx="12" cy="5" r="1.9" />
            <circle cx="12" cy="12" r="1.9" />
            <circle cx="12" cy="19" r="1.9" />
          </svg>
        </MenuButton>
      </Header>
      {eventId && (
        <PillTabs
          label="Событие и чат"
          tabs={[
            { to: `/calendar/events/${eventId}`, label: 'Событие', active: false },
            { to: `/chat/event-${eventId}`, label: 'Чат', active: true },
          ]}
        />
      )}

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
                      replyAuthor={message.replyTo ? sender(message.replyTo.senderId) : undefined}
                      senderMood={currentMood(members.find((m) => m.id === message.senderId)?.mood, now)?.emoji}
                      showSender={chat === FAMILY_CHAT || !!eventId}
                      status={message.senderId === me ? messageStatus(message, thread?.readUpTo ?? null) : undefined}
                      onFeedback={() => setFeedbackFor(message)}
                      onOpenPhoto={(index) => setViewing({ message, index })}
                    />
                  ))}
                </section>
              ))}
              <PendingMessages items={pending} onRetry={(key) => { const item = pending.find((p) => p.key === key); if (item) void deliver(item) }} onRemove={(key) => setPending((list) => list.filter((p) => p.key !== key))} />
            </>
          )}
        </FeedContent>
      </Feed>

      <Composer
        initialText={sharedText}
        reply={replyingTo && { name: sender(replyingTo.senderId) ?? 'Участник', text: replyPreview(replyingTo) }}
        onCancelReply={() => setReplyingTo(undefined)}
        editing={editing && { id: editing.id, text: editing.caption }}
        onCancelEdit={() => setEditing(undefined)}
        onEditSubmit={handleEdit}
        onSend={handleSend} onUpload={handleUpload} onUploadFile={handleUploadFile} />

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
          onReply={() => {
            setEditing(undefined)
            setReplyingTo(feedbackFor)
            setFeedbackFor(undefined)
          }}
          onEdit={
            feedbackFor.senderId === me && feedbackFor.caption
              ? () => {
                  setReplyingTo(undefined)
                  setEditing(feedbackFor)
                  setFeedbackFor(undefined)
                }
              : undefined
          }
          onDelete={feedbackFor.senderId === me ? handleDelete : undefined}
          onClose={() => setFeedbackFor(undefined)}
        />
      )}
    </Room>
  )
}
