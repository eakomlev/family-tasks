import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AppState, FlatList, KeyboardAvoidingView, Platform, Pressable, View } from 'react-native'
import { Redirect, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import styled, { useTheme } from 'styled-components/native'
import { FAMILY_CHAT, listMessages, uploadChatFile, uploadChatPhoto, type ChatMessage, type MessageFeedback } from '@/api'
import { useChats } from '@/chat/context'
import { ActionSheet } from '@/components/ActionSheet'
import { Avatar } from '@/components/Avatar'
import { Button } from '@/components/Button'
import { Notice } from '@/components/Notice'
import { Text } from '@/components/Text'
import { useIdentity } from '@/identity/context'
import { currentMood } from '@/lib/mood'
import { retryRead } from '@/lib/retry'
import { isParent, memberLabel } from '@/lib/roles'
import { useNow } from '@/lib/useNow'
import { useProfile } from '@/profile/context'
import { useViewingChat } from '@/realtime/context'
import { toApiError } from '@/store/api'
import { useGetMessagesQuery, useGiveFeedbackMutation, useMarkChatReadMutation, useSendMessageMutation } from '@/store/chat'
import { Composer, type OutgoingMessage } from './Composer'
import { FeedbackDialog } from './FeedbackDialog'
import { MessageBubble } from './MessageBubble'
import { PhotoViewer } from './PhotoViewer'
import { chatTitle } from './listUtils'
import { appendMessage, groupByDay, mergeLatest, messageStatus, participantsLabel, replaceMessage, visitLabel } from './roomUtils'
import { useChatActions } from './useChatActions'

const Header = styled.View`
  flex-direction: row;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border-bottom-width: 1px;
  border-bottom-color: ${({ theme }) => theme.colors.border};
  background-color: ${({ theme }) => theme.colors.bg};
`

// элемент ленты: сообщение или подпись дня (лента перевёрнута: новые внизу)
type Row = { kind: 'day'; key: string; label: string } | { kind: 'message'; key: string; message: ChatMessage }

function ChatMenu({ chat, onClose }: { chat: string; onClose: () => void }) {
  const actions = useChatActions(chat)
  return <ActionSheet actions={actions} onClose={onClose} />
}

// Переписка: /chat/family или /chat/<id собеседника>. Лента перевёрнутая (`inverted`): она сама держит низ, клавиатуру и подгрузку старых
// сообщений вверху без прыжков.
export function ChatRoomScreen({ chat }: { chat: string }) {
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
  const [menuOpen, setMenuOpen] = useState(false)
  // открытый просмотр фото: сообщение и номер фото в нём
  const [viewing, setViewing] = useState<{ message: ChatMessage; index: number }>()
  // чужое сообщение, до которого уже отметили прочитанное: без этого отметка вызывает событие, событие новый запрос, и так по кругу
  const markedRef = useRef<string | undefined>(undefined)

  const queryError = query.error
  const missing = !!queryError && 'status' in queryError && (queryError.status === 404 || queryError.status === 400)
  const failed = olderFailed || (!!queryError && !missing && !thread)

  // пока чат открыт, пуши о его сообщениях не нужны
  useViewingChat(chat)

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
    if (newest && markedRef.current !== `${chat}:${newest.id}`) {
      markedRef.current = `${chat}:${newest.id}`
      void markRead()
    }
  }, [page, chat, me, markRead])

  // вернулись в приложение: пока читали что-то другое, могли прийти сообщения
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => state === 'active' && void markRead())
    return () => sub.remove()
  }, [markRead])

  // строки ленты: от свежих к старым (список перевёрнут), подпись дня стоит после сообщений своего дня
  const rows = useMemo<Row[]>(() => {
    if (!messages) return []
    const list: Row[] = []
    for (const group of groupByDay(messages, now)) {
      list.push({ kind: 'day', key: `day-${group.key}`, label: group.label })
      for (const message of group.messages) list.push({ kind: 'message', key: message.id, message })
    }
    return list.reverse()
  }, [messages, now])

  if (!identity || !me || !token) return null
  if (missing) return <Redirect href="/chat" />

  const other = chat === FAMILY_CHAT ? undefined : members.find((m) => m.id === chat)
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

  // должна бросить ошибку, если не вышло: поле ввода тогда оставит текст и вложения
  async function handleSend({ text, mediaIds, fileIds }: OutgoingMessage) {
    const { message } = await sendMessage({ chat, text, mediaIds, fileIds }).unwrap().catch(toApiError)
    setThread((current) => ({ messages: appendMessage(current?.messages ?? [], message), hasMore: current?.hasMore ?? false, readUpTo: current?.readUpTo ?? null }))
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

  const title = chatTitle(chat, members, identity.role)
  const subtitle = chat === FAMILY_CHAT ? participantsLabel(members.length) : visitLabel(peer, now)
  const muted = chats?.find((c) => c.id === chat)?.muted
  const otherMood = other ? currentMood(other.mood, now)?.emoji : undefined

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Header style={{ paddingTop: insets.top + 8 }}>
        <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/chat'))} accessibilityRole="button" accessibilityLabel="К списку чатов" hitSlop={10}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </Pressable>
        <Pressable
          disabled={!other}
          onPress={() => other && router.push({ pathname: '/family/[memberId]', params: { memberId: other.id } })}
          style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 }}
        >
          {other ? (
            <Avatar name={memberLabel(other, identity.role)} seed={other.id} src={other.avatar} size={38} />
          ) : (
            <View style={{ width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accentSoft }}>
              <Ionicons name="people" size={20} color={colors.accent} />
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
        <Pressable onPress={() => setMenuOpen(true)} accessibilityRole="button" accessibilityLabel="Меню чата" hitSlop={10}>
          <Ionicons name="ellipsis-vertical" size={22} color={colors.text} />
        </Pressable>
      </Header>

      <FlatList
        data={rows}
        inverted
        keyExtractor={(row) => row.key}
        contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 8 }}
        keyboardShouldPersistTaps="handled"
        onEndReached={() => void loadOlder()}
        onEndReachedThreshold={0.4}
        renderItem={({ item: row }) =>
          row.kind === 'day' ? (
            <Text $size={12} $weight="bold" $tone="muted" style={{ alignSelf: 'center', marginVertical: 8 }}>
              {row.label}
            </Text>
          ) : (
            <MessageBubble
              message={row.message}
              mine={row.message.senderId === me}
              senderName={sender(row.message.senderId)}
              senderMood={currentMood(members.find((m) => m.id === row.message.senderId)?.mood, now)?.emoji}
              showSender={chat === FAMILY_CHAT}
              status={row.message.senderId === me ? messageStatus(row.message, thread?.readUpTo ?? null) : undefined}
              onFeedback={() => setFeedbackFor(row.message)}
              onOpenPhoto={(index) => setViewing({ message: row.message, index })}
            />
          )
        }
        ListEmptyComponent={
          // перевёрнутый список зеркалит содержимое: пустое состояние переворачиваем обратно
          <View style={{ transform: [{ scaleY: -1 }], padding: 24 }}>
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

      <Composer onSend={handleSend} onUpload={handleUpload} onUploadFile={handleUploadFile} />

      {viewing && <PhotoViewer photos={viewing.message.media} index={viewing.index} onClose={() => setViewing(undefined)} />}
      {menuOpen && <ChatMenu chat={chat} onClose={() => setMenuOpen(false)} />}
      {feedbackFor && (
        <FeedbackDialog
          authorName={sender(feedbackFor.senderId) ?? 'Участник'}
          canAward={canAward(feedbackFor)}
          myEmoji={feedbackFor.reactions.find((r) => r.memberId === me)?.emoji}
          onSubmit={handleFeedback}
          onClose={() => setFeedbackFor(undefined)}
        />
      )}
    </KeyboardAvoidingView>
  )
}
