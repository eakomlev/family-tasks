import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AppState, Dimensions, FlatList, Keyboard, KeyboardAvoidingView, Pressable, View } from 'react-native'
import { Redirect, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import styled, { useTheme } from 'styled-components/native'
import { FAMILY_CHAT, isEventChat, listMessages, uploadChatFile, uploadChatPhoto, uploadChatVideo, type ChatMessage, type ChatVideo, type MessageFeedback } from '@/api'
import { useChats } from '@/chat/context'
import { ActionSheet } from '@/components/ActionSheet'
import { MenuButton } from '@/components/PopupMenu'
import { Avatar } from '@/components/Avatar'
import { Button } from '@/components/Button'
import { Notice } from '@/components/Notice'
import { Text } from '@/components/Text'
import { useIdentity } from '@/identity/context'
import { withAlpha } from '@/lib/colorAlpha'
import { currentMood } from '@/lib/mood'
import { retryRead } from '@/lib/retry'
import { isParent, memberLabel } from '@/lib/roles'
import { useNow } from '@/lib/useNow'
import { useProfile } from '@/profile/context'
import { useViewingChat } from '@/realtime/context'
import { toApiError } from '@/store/api'
import { useDeleteMessageMutation, useEditMessageMutation, useGetMessagesQuery, useGiveFeedbackMutation, useMarkChatReadMutation, useSendMessageMutation } from '@/store/chat'
import { playSendSound } from '@/lib/sound'
import { takePendingShare } from '@/lib/incomingShare'
import { Composer, type OutgoingMessage } from './Composer'
import { FeedbackDialog } from './FeedbackDialog'
import { MessageBubble } from './MessageBubble'
import { PhotoViewer } from './PhotoViewer'
import { VideoPlayer } from './VideoPlayer'
import { chatTitle } from './listUtils'
import { consumePending, discardPending, isPendingId, pendingToMessage, retrySend, startSend, usePending, type PendingMessage } from './pending'
import { appendMessage, groupByDay, mergeLatest, messageStatus, participantsLabel, replaceMessage, visitLabel } from './roomUtils'
import { useChatActions } from './useChatActions'

const Header = styled.View`
  flex-direction: row;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
`

// Выдержка из сообщения для ответа: текст или, у сообщения только с вложениями, заглушка
const replyPreview = (message: ChatMessage) => (message.caption || message.text).replace(/s+/g, ' ').trim().slice(0, 140)

// элемент ленты: сообщение или подпись дня (лента перевёрнута: новые внизу)
type Row = { kind: 'day'; key: string; label: string } | { kind: 'message'; key: string; message: ChatMessage; delivery?: 'sending' | 'failed'; pendingId?: string }

// Три точки в шапке: меню раскрывается рядом со значком
function ChatMenuButton({ chat }: { chat: string }) {
  const actions = useChatActions(chat)
  return <MenuButton actions={actions} accessibilityLabel="Меню чата" filled={false} />
}

// Переписка: /chat/family или /chat/<id собеседника>. Лента перевёрнутая (`inverted`): она сама держит низ, клавиатуру и подгрузку старых
// сообщений вверху без прыжков.
interface ChatRoomProps {
  chat: string
  // внутри страницы события: без своей шапки и без отступа под системную строку; название события и признак «вкладка открыта» приходят от страницы
  embedded?: boolean
  // вкладка с чатом на виду: только тогда чат считается открытым (пуши молчат, сообщения помечаются прочитанными)
  active?: boolean
  eventTitle?: string
}

export function ChatRoomScreen({ chat, embedded = false, active = true, eventTitle }: ChatRoomProps) {
  const { identity } = useIdentity()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { colors } = useTheme()
  const { data } = useProfile()
  const now = useNow()
  const { chats } = useChats()

  const token = identity?.token
  const me = identity?.memberId
  const members = data?.members ?? []

  // Свежая первая страница из кэша: сохранённая на устройстве видна сразу, свежая приходит следом, а по сигналу сокета
  // кэш сбрасывается и страница запрашивается заново. Более старые страницы подгружает сам экран и держит у себя.
  const query = useGetMessagesQuery(chat, { skip: !token })
  const page = query.data
  const [sendMessage] = useSendMessageMutation()
  const [giveFeedback] = useGiveFeedbackMutation()
  const [editMessage] = useEditMessageMutation()
  const [deleteMessage] = useDeleteMessageMutation()
  const [markChatRead] = useMarkChatReadMutation()

  const [thread, setThread] = useState<{ messages: ChatMessage[]; hasMore: boolean; readUpTo: string | null } | undefined>(
    () => page && { messages: page.messages, hasMore: page.hasMore, readUpTo: page.readUpTo },
  )
  const peer = page?.peer ?? null
  const messages = thread?.messages
  const hasMore = thread?.hasMore ?? false
  const [olderFailed, setOlderFailed] = useState(false)
  const [loadingOlder, setLoadingOlder] = useState(false)
  const [feedbackFor, setFeedbackFor] = useState<ChatMessage>()
  // на какое сообщение отвечаем и какое правим (одновременно только одно из двух)
  const [replyingTo, setReplyingTo] = useState<ChatMessage>()
  const [editing, setEditing] = useState<ChatMessage>()
  // не отправленное сообщение, для которого открыто меню («Отправить ещё раз» и «Удалить»)
  const [failedMenu, setFailedMenu] = useState<string>()
  // свои сообщения, которые ещё уходят или не ушли (лежат вне экрана, отправка идёт и после выхода из чата)
  const pending = usePending(chat)
  // открытый просмотр фото: сообщение и номер фото в нём
  const [viewing, setViewing] = useState<{ message: ChatMessage; index: number }>()
  // открытое видео
  const [watching, setWatching] = useState<ChatVideo>()
  // чужое сообщение, до которого уже отметили прочитанное: без этого отметка вызывает событие, событие новый запрос, и так по кругу
  const markedRef = useRef<string | undefined>(undefined)
  // поделились из другого приложения и выбрали этот чат: полученное ложится в поле ввода (читается один раз при открытии)
  const [incoming] = useState(() => (embedded ? null : takePendingShare()))
  // Внутри страницы события экран стоит внутри пейджера, а KeyboardAvoidingView не знает своего смещения от верха экрана и поднимает поле
  // ввода не до конца: там отступ снизу равен части экрана под верхним краем клавиатуры (вместе с системной панелью внизу;
  // нижняя панель вкладок на это время прячется)
  const [keyboardHeight, setKeyboardHeight] = useState(0)
  // высота парящей шапки и панели ввода: лента идёт под них и оставляет место на их высоту
  const [topHeight, setTopHeight] = useState(0)
  const [bottomHeight, setBottomHeight] = useState(0)
  useEffect(() => {
    if (!embedded) return
    const show = Keyboard.addListener('keyboardDidShow', (e) => setKeyboardHeight(Math.max(e.endCoordinates.height, Dimensions.get('screen').height - e.endCoordinates.screenY)))
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardHeight(0))
    return () => {
      show.remove()
      hide.remove()
    }
  }, [embedded])

  const queryError = query.error
  const missing = !!queryError && 'status' in queryError && (queryError.status === 404 || queryError.status === 400)
  const failed = olderFailed || (!!queryError && !missing && !thread)

  // пока чат открыт, пуши о его сообщениях не нужны
  useViewingChat(active ? chat : undefined)

  // Прочитано: список чатов и значок на табе обновятся сами (мутация сбрасывает кэш списка чатов)
  const markRead = useCallback(async () => {
    try {
      await markChatRead(chat).unwrap()
    } catch {
      /* не критично: отметка повторится при следующем сообщении */
    }
  }, [chat, markChatRead])

  // пришла первая страница (из сети или после сигнала сокета): сливаем с уже подгруженными старыми сообщениями
  useEffect(() => {
    if (!page) return
    setThread((current) => ({
      ...mergeLatest(current?.messages ?? [], page.messages, page.hasMore, current?.hasMore ?? false),
      readUpTo: page.readUpTo,
    }))
    setOlderFailed(false)
    const newest = [...page.messages].reverse().find((m) => m.senderId !== me)
    if (active && newest && markedRef.current !== `${chat}:${newest.id}`) {
      markedRef.current = `${chat}:${newest.id}`
      void markRead()
    }
  }, [page, chat, me, markRead, active])

  // ушедшее сообщение переезжает из «ждущих» в ленту одним шагом, без мигания
  useEffect(() => {
    const done = pending.filter((p): p is PendingMessage & { sent: ChatMessage } => p.status === 'done' && !!p.sent)
    if (done.length === 0) return
    setThread((current) => ({
      messages: done.reduce((list, p) => appendMessage(list, p.sent), current?.messages ?? []),
      hasMore: current?.hasMore ?? false,
      readUpTo: current?.readUpTo ?? null,
    }))
    done.forEach((p) => consumePending(p.id))
  }, [pending])

  // вернулись в приложение: пока читали что-то другое, могли прийти сообщения
  useEffect(() => {
    if (!active) return
    const sub = AppState.addEventListener('change', (state) => state === 'active' && void markRead())
    return () => sub.remove()
  }, [markRead, active])

  // вкладка с чатом открыта после того, как сообщения уже пришли: отметить прочитанным сейчас
  useEffect(() => {
    if (active && page) {
      const newest = [...page.messages].reverse().find((m) => m.senderId !== me)
      if (newest && markedRef.current !== `${chat}:${newest.id}`) {
        markedRef.current = `${chat}:${newest.id}`
        void markRead()
      }
    }
    // только при открытии вкладки
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active])

  // строки ленты: от свежих к старым (список перевёрнут), подпись дня стоит после сообщений своего дня
  const rows = useMemo<Row[]>(() => {
    if (!messages && pending.length === 0) return []
    // свои неотправленные сообщения идут после остальных: они самые новые
    const waiting = pending.filter((p) => p.status !== 'done')
    const delivery = new Map(waiting.map((p) => [p.id, p.status as 'sending' | 'failed']))
    const all = [...(messages ?? []), ...waiting.map((p) => pendingToMessage(p, me ?? ''))]
    const list: Row[] = []
    for (const group of groupByDay(all, now)) {
      list.push({ kind: 'day', key: `day-${group.key}`, label: group.label })
      for (const message of group.messages) list.push({ kind: 'message', key: message.id, message, delivery: delivery.get(message.id), pendingId: isPendingId(message.id) ? message.id : undefined })
    }
    return list.reverse()
  }, [messages, pending, now, me])

  if (!identity || !me || !token) return null
  if (missing) return embedded ? null : <Redirect href="/chat" />

  const isEvent = isEventChat(chat)
  const other = chat === FAMILY_CHAT || isEvent ? undefined : members.find((m) => m.id === chat)
  // Аватар слева от чужого сообщения в групповом чате, как в Телеграме: у последнего подряд от одного автора в этом дне, у предыдущих
  // пустое место (null). Строки идут от новых к старым, поэтому следующее по времени стоит перед этим (index - 1).
  const senderAvatar = (message: ChatMessage, next?: Row) => {
    if (!(chat === FAMILY_CHAT || isEvent) || message.senderId === me) return undefined
    if (next?.kind === 'message' && next.message.senderId === message.senderId) return null
    const member = members.find((m) => m.id === message.senderId)
    return { name: sender(message.senderId) ?? 'Участник', seed: message.senderId, src: member?.avatar }
  }
  // подпись автора в общем чате: ребёнок видит родителей как «Мама» и «Папа»
  const sender = (id: string) => {
    const member = members.find((m) => m.id === id)
    return member && memberLabel(member, identity.role)
  }

  async function loadOlder() {
    if (!messages?.length || loadingOlder || !hasMore) return
    setLoadingOlder(true)
    try {
      const older = await retryRead(() => listMessages(token!, chat, messages[0].id))
      setThread((current) => ({ messages: [...older.messages, ...(current?.messages ?? [])], hasMore: older.hasMore, readUpTo: current?.readUpTo ?? null }))
    } catch {
      setOlderFailed(true)
    } finally {
      setLoadingOlder(false)
    }
  }

  // загрузка одного фото для сообщения: уходит сразу после выбора, к сообщению прикрепляется при отправке
  async function handleUpload(photo: Blob) {
    const { mediaId } = await uploadChatPhoto(token!, chat, photo)
    return mediaId
  }

  // загрузка одного файла (не фото) для сообщения
  async function handleUploadFile(file: { blob: Blob; name: string }) {
    const { fileId } = await uploadChatFile(token!, chat, file)
    return fileId
  }

  // загрузка одного видео для сообщения (сервер сжимает его перед ответом)
  async function handleUploadVideo(video: { blob: Blob; type: string }) {
    const { videoId } = await uploadChatVideo(token!, chat, video)
    return videoId
  }

  // Сообщение появляется в ленте сразу и уходит в фоне; не ушло, значит красная иконка с повторной отправкой
  function handleSend({ text, mediaIds, fileIds, videoIds, photoUris, files, videos }: OutgoingMessage) {
    playSendSound()
    const reply = replyingTo && { id: replyingTo.id, senderId: replyingTo.senderId, text: replyPreview(replyingTo) }
    setReplyingTo(undefined)
    startSend({ chat, text, mediaIds, fileIds, videoIds, photoUris, files, videos, replyTo: reply }, (draft) =>
      sendMessage({ chat, text: draft.text, mediaIds: draft.mediaIds, fileIds: draft.fileIds, videoIds: draft.videoIds, replyTo: draft.replyTo?.id })
        .unwrap()
        .then((res) => res.message)
        .catch(toApiError),
    )
  }

  // Реакцию можно поставить на любое сообщение, а монеты начисляют только родители (мама, папа) и только за сообщения детей.
  const canAward = (message: ChatMessage) => isParent(identity.role) && members.find((m) => m.id === message.senderId)?.role === 'child'

  async function handleFeedback(feedback: MessageFeedback) {
    const target = feedbackFor
    if (!target) return
    const { message } = await giveFeedback({ chat, messageId: target.id, feedback }).unwrap().catch(toApiError)
    setThread((current) => current && { ...current, messages: replaceMessage(current.messages, message) })
    setFeedbackFor(undefined)
  }

  async function handleEdit(text: string) {
    if (!editing) return
    const { message } = await editMessage({ chat, messageId: editing.id, text }).unwrap().catch(toApiError)
    setThread((current) => current && { ...current, messages: replaceMessage(current.messages, message) })
    setEditing(undefined)
  }

  async function handleDelete() {
    const target = feedbackFor
    if (!target) return
    await deleteMessage({ chat, messageId: target.id }).unwrap().catch(toApiError)
    setThread((current) => current && { ...current, messages: current.messages.filter((m) => m.id !== target.id) })
    setFeedbackFor(undefined)
  }

  const summary = chats?.find((c) => c.id === chat)
  const title = chatTitle(chat, members, identity.role, eventTitle ?? summary?.event?.title)
  // у чата события участников больше одного: число не знаем, подпись не показываем
  const subtitle = chat === FAMILY_CHAT ? participantsLabel(members.length) : isEvent ? 'Чат события' : visitLabel(peer, now)
  const muted = summary?.muted
  const otherMood = other ? currentMood(other.mood, now)?.emoji : undefined

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg, paddingBottom: keyboardHeight }} behavior={embedded ? undefined : 'padding'}>
      <View style={{ flex: 1 }}>
      {!embedded && (
      <View pointerEvents="box-none" onLayout={(e) => setTopHeight(Math.round(e.nativeEvent.layout.height))} style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 6 }}>
      {/* затемнение ленты под шапкой: от фона сверху к прозрачному */}
      <LinearGradient
        pointerEvents="none"
        colors={[withAlpha(colors.bg, 0.96), withAlpha(colors.bg, 0.96), withAlpha(colors.bg, 0)]}
        locations={[0, 0.62, 1]}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: -28 }}
      />
      <Header style={{ paddingTop: insets.top + 8 }}>
        <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/chat'))} accessibilityRole="button" accessibilityLabel="К списку чатов" hitSlop={10}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </Pressable>
        <Pressable
          onPress={() => router.push({ pathname: '/chat/[chat]/info', params: { chat } })}
          accessibilityRole="button"
          accessibilityLabel="Информация о чате"
          style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 }}
        >
          {other ? (
            <Avatar name={memberLabel(other, identity.role)} seed={other.id} src={other.avatar} size={38} />
          ) : (
            <View style={{ width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accentSoft }}>
              <Ionicons name={isEvent ? 'calendar' : 'people'} size={20} color={colors.accent} />
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text $weight="black" $size={17} numberOfLines={1}>
              {`${title}${otherMood ? ` ${otherMood}` : ''}`}
            </Text>
            {subtitle ? (
              <Text $size={12} $tone="muted" numberOfLines={1}>
                {subtitle}
              </Text>
            ) : null}
          </View>
          {muted && <Ionicons name="notifications-off-outline" size={16} color={colors.muted} />}
        </Pressable>
        <ChatMenuButton chat={chat} />
      </Header>
      </View>
      )}

      <FlatList
        data={rows}
        inverted
        keyExtractor={(row) => row.key}
        contentContainerStyle={{ paddingHorizontal: 12, paddingTop: bottomHeight + 8, paddingBottom: topHeight + 8 }}
        keyboardShouldPersistTaps="handled"
        onEndReached={() => void loadOlder()}
        onEndReachedThreshold={0.4}
        renderItem={({ item: row, index }) =>
          row.kind === 'day' ? (
            <Text $size={12} $weight="bold" $tone="muted" style={{ alignSelf: 'center', marginVertical: 8 }}>
              {row.label}
            </Text>
          ) : (
            <MessageBubble
              message={row.message}
              mine={row.message.senderId === me}
              senderName={sender(row.message.senderId)}
              replyAuthor={row.message.replyTo ? sender(row.message.replyTo.senderId) : undefined}
              senderMood={currentMood(members.find((m) => m.id === row.message.senderId)?.mood, now)?.emoji}
              showSender={chat === FAMILY_CHAT || isEvent}
              senderAvatar={senderAvatar(row.message, rows[index - 1])}
              status={row.message.senderId === me && !row.pendingId ? messageStatus(row.message, thread?.readUpTo ?? null) : undefined}
              delivery={row.delivery}
              onFailedPress={() => setFailedMenu(row.pendingId)}
              onFeedback={row.pendingId ? undefined : () => setFeedbackFor(row.message)}
              onOpenPhoto={row.pendingId ? undefined : (index) => setViewing({ message: row.message, index })}
              onOpenVideo={row.pendingId ? undefined : (index) => setWatching(row.message.videos?.[index])}
            />
          )
        }
        ListEmptyComponent={
          <View style={{ padding: 24 }}>
            {failed ? <Notice tone="error">Не удалось загрузить сообщения. Проверьте соединение.</Notice> : !messages ? <Text $tone="muted" style={{ textAlign: 'center' }}>Загрузка…</Text> : <Text $tone="muted" style={{ textAlign: 'center' }}>Сообщений пока нет. Напишите первым.</Text>}
          </View>
        }
        ListFooterComponent={
          messages && hasMore ? (
            <Button variant="text" disabled={loadingOlder} onPress={() => void loadOlder()}>
              {loadingOlder ? 'Загрузка…' : 'Показать более ранние'}
            </Button>
          ) : (
            <View />
          )
        }
        style={{ flex: 1 }}
      />

      <Composer
        incoming={incoming}
        reply={replyingTo && { name: sender(replyingTo.senderId) ?? 'Участник', text: replyPreview(replyingTo) }}
        onCancelReply={() => setReplyingTo(undefined)}
        editing={editing && { id: editing.id, text: editing.caption }}
        onCancelEdit={() => setEditing(undefined)}
        onEditSubmit={handleEdit}
        onSend={handleSend} onUpload={handleUpload} onUploadFile={handleUploadFile} onUploadVideo={handleUploadVideo} flushBottom={embedded} onHeight={setBottomHeight} />
      </View>

      {watching && <VideoPlayer video={watching} onClose={() => setWatching(undefined)} />}
      {viewing && <PhotoViewer photos={viewing.message.media} index={viewing.index} onClose={() => setViewing(undefined)} />}
      {failedMenu && (
        <ActionSheet
          title="Сообщение не отправлено"
          onClose={() => setFailedMenu(undefined)}
          actions={[
            { key: 'retry', label: 'Отправить ещё раз', onSelect: () => retrySend(failedMenu) },
            { key: 'delete', label: 'Удалить', danger: true, onSelect: () => discardPending(failedMenu) },
          ]}
        />
      )}
      {feedbackFor && (
        <FeedbackDialog
          authorName={sender(feedbackFor.senderId) ?? 'Участник'}
          canAward={canAward(feedbackFor)}
          myEmoji={feedbackFor.reactions.find((r) => r.memberId === me)?.emoji}
          onSubmit={handleFeedback}
          onReply={() => {
            setEditing(undefined)
            setReplyingTo(feedbackFor)
            setFeedbackFor(undefined)
          }}
          onEdit={feedbackFor.senderId === me && feedbackFor.caption ? () => {
            setReplyingTo(undefined)
            setEditing(feedbackFor)
            setFeedbackFor(undefined)
          } : undefined}
          onDelete={feedbackFor.senderId === me ? handleDelete : undefined}
          onClose={() => setFeedbackFor(undefined)}
        />
      )}
    </KeyboardAvoidingView>
  )
}
