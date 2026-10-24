import { useEffect, useState, type ReactNode } from 'react'
import { FlatList, Linking, Pressable, Switch, useWindowDimensions, View } from 'react-native'
import { Redirect, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTheme } from 'styled-components/native'
import { FAMILY_CHAT, isEventChat, listChatLinks, listChatMedia, searchChatMessages, type ChatLink, type ChatMediaItem, type ChatSearchResult } from '@/api'
import { useChats } from '@/chat/context'
import { Avatar } from '@/components/Avatar'
import { Button } from '@/components/Button'
import { CachedImage } from '@/components/CachedImage'
import { Input } from '@/components/Input'
import { Notice } from '@/components/Notice'
import { PageHeader } from '@/components/PageHeader'
import { TOP_CORNER } from '@/components/Screen'
import { SlidingTabs } from '@/components/SlidingTabs'
import { Heading, Text } from '@/components/Text'
import { useIdentity } from '@/identity/context'
import { ageFromBirthDate, formatAge, formatBirthDate } from '@/lib/date'
import { ROLE_LABELS, memberLabel } from '@/lib/roles'
import { useProfile } from '@/profile/context'
import { toApiError } from '@/store/api'
import { useSetChatMutedMutation } from '@/store/chat'
import { PhotoViewer } from './PhotoViewer'
import { chatTitle } from './listUtils'
import { dayLabel, formatMessageTime, participantsLabel } from './roomUtils'
import { useCursorList } from './useCursorList'

const GAP = 4
const COLUMNS = 3
type Tab = 'media' | 'links'

// Строка-кнопка в блоке действий
function ActionRow({ icon, label, onPress, right }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress?: () => void; right?: ReactNode }) {
  const { colors } = useTheme()
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      style={{ minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16 }}
    >
      <Ionicons name={icon} size={22} color={colors.accent} />
      <Text $weight="bold" style={{ flex: 1 }}>
        {label}
      </Text>
      {right}
    </Pressable>
  )
}

// Информация о чате, как в Телеграме: собеседник (или общий чат, или событие), уведомления, поиск по сообщениям и ниже вкладки
// «Медиа» (все фото) и «Ссылки» (все ссылки из сообщений). Список один, прокручивается целиком.
export function ChatInfoScreen({ chat }: { chat: string }) {
  const router = useRouter()
  const { colors } = useTheme()
  const insets = useSafeAreaInsets()
  const { width } = useWindowDimensions()
  const { identity } = useIdentity()
  const { data } = useProfile()
  const { chats } = useChats()
  const [setMuted] = useSetChatMutedMutation()
  const token = identity?.token

  const [tab, setTab] = useState<Tab>('media')
  const [searching, setSearching] = useState(false)
  const [text, setText] = useState('')
  // запрос уходит с небольшой задержкой после набора, чтобы не слать его на каждую букву
  const [query, setQuery] = useState('')
  const [viewing, setViewing] = useState<number>()
  const [muteError, setMuteError] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setQuery(text.trim()), 350)
    return () => clearTimeout(timer)
  }, [text])

  const media = useCursorList<ChatMediaItem>(
    async (before) => {
      const page = await listChatMedia(token!, chat, before)
      return { items: page.items, hasMore: page.hasMore, cursor: page.items.length > 0 ? page.items[page.items.length - 1].id : null }
    },
    [chat, token],
    !!token && !searching && tab === 'media',
  )
  const links = useCursorList<ChatLink>(
    async (before) => {
      const page = await listChatLinks(token!, chat, before)
      return { items: page.items, hasMore: page.hasMore, cursor: page.lastMessageId }
    },
    [chat, token],
    !!token && !searching && tab === 'links',
  )
  const found = useCursorList<ChatSearchResult>(
    async (before) => {
      const page = await searchChatMessages(token!, chat, query, before)
      return { items: page.messages, hasMore: page.hasMore, cursor: page.messages.length > 0 ? page.messages[page.messages.length - 1].id : null }
    },
    [chat, token, query],
    !!token && searching && query.length > 0,
  )

  if (!identity) return <Redirect href="/chat" />
  const members = data?.members ?? []
  const summary = chats?.find((c) => c.id === chat)
  const isEvent = isEventChat(chat)
  const other = chat === FAMILY_CHAT || isEvent ? undefined : members.find((m) => m.id === chat)
  const title = chatTitle(chat, members, identity.role, summary?.event?.title)
  const muted = summary?.muted ?? false
  const nameOf = (id: string) => {
    const member = members.find((m) => m.id === id)
    return member ? memberLabel(member, identity.role) : 'Участник'
  }
  const now = new Date()
  const when = (iso: string) => `${dayLabel(iso, now)}, ${formatMessageTime(iso)}`
  const side = (width - 40 - GAP * (COLUMNS - 1)) / COLUMNS

  async function toggleMute() {
    setMuteError(false)
    try {
      await setMuted({ chat, muted: !muted }).unwrap().catch(toApiError)
    } catch {
      setMuteError(true)
    }
  }

  function stopSearch() {
    setSearching(false)
    setText('')
    setQuery('')
  }

  const mode: 'search' | Tab = searching ? 'search' : tab
  const active = mode === 'search' ? found : mode === 'media' ? media : links
  const showEmpty = active.items !== undefined && active.items.length === 0 && !active.failed && (mode !== 'search' || query.length > 0)
  const emptyText = mode === 'media' ? 'В этом чате пока нет фото.' : mode === 'links' ? 'В этом чате пока нет ссылок.' : 'Ничего не найдено.'

  const header = (
    <View style={{ gap: 14, paddingBottom: 8 }}>
      <PageHeader fallback={{ pathname: '/chat/[chat]', params: { chat } }}>Информация</PageHeader>

      <View style={{ alignItems: 'center', gap: 6, paddingVertical: 8 }}>
        {other ? (
          <Avatar name={memberLabel(other, identity.role)} seed={other.id} src={other.avatar} size={96} />
        ) : (
          <View style={{ width: 96, height: 96, borderRadius: 48, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accentSoft }}>
            <Ionicons name={isEvent ? 'calendar' : 'people'} size={44} color={colors.accent} />
          </View>
        )}
        <Heading style={{ textAlign: 'center' }}>{title}</Heading>
        {other && (
          <>
            <Text $tone="accent" $weight="bold">
              {ROLE_LABELS[other.role]}
            </Text>
            {other.birthDate && <Text $tone="muted">{`${formatBirthDate(other.birthDate)} · ${formatAge(ageFromBirthDate(other.birthDate))}`}</Text>}
            <Button variant="text" onPress={() => router.push({ pathname: '/family/[memberId]', params: { memberId: other.id } })}>
              Открыть профиль
            </Button>
          </>
        )}
        {chat === FAMILY_CHAT && <Text $tone="muted">{participantsLabel(members.length)}</Text>}
        {isEvent && (
          <>
            <Text $tone="muted">Чат события</Text>
            <Button variant="text" onPress={() => router.push({ pathname: '/calendar/events/[id]', params: { id: chat.slice('event-'.length) } })}>
              Открыть событие
            </Button>
          </>
        )}
      </View>

      <View style={{ borderRadius: 18, borderWidth: 1, borderColor: colors.cardBorder, backgroundColor: colors.surface, overflow: 'hidden' }}>
        <ActionRow
          icon={muted ? 'notifications-off-outline' : 'notifications-outline'}
          label="Уведомления"
          onPress={() => void toggleMute()}
          right={<Switch value={!muted} onValueChange={() => void toggleMute()} accessibilityLabel={muted ? 'Включить уведомления' : 'Отключить уведомления'} trackColor={{ true: colors.accent }} />}
        />
        <View style={{ height: 1, backgroundColor: colors.border, opacity: 0.6, marginLeft: 52 }} />
        <ActionRow icon="search-outline" label="Поиск сообщений" onPress={() => setSearching(true)} />
      </View>
      {muteError && <Notice tone="error">Не удалось изменить уведомления. Попробуйте ещё раз.</Notice>}

      {searching ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={{ flex: 1 }}>
            <Input autoFocus value={text} onChangeText={setText} placeholder="Поиск по сообщениям" accessibilityLabel="Поиск по сообщениям" returnKeyType="search" autoCorrect={false} />
          </View>
          <Button variant="text" onPress={stopSearch}>
            Отмена
          </Button>
        </View>
      ) : (
        <SlidingTabs
          selected={tab}
          onSelect={(key) => setTab(key as Tab)}
          tabs={[
            { key: 'media', render: (on) => <Text $weight="extraBold" $size={14} style={on ? { color: '#ffffff' } : undefined}>Медиа</Text> },
            { key: 'links', render: (on) => <Text $weight="extraBold" $size={14} style={on ? { color: '#ffffff' } : undefined}>Ссылки</Text> },
          ]}
        />
      )}

      {active.failed && !active.items && <Notice tone="error">Не удалось загрузить. Проверьте соединение.</Notice>}
      {active.failed && !active.items && (
        <Button variant="text" onPress={active.reload}>
          Повторить
        </Button>
      )}
      {!active.items && !active.failed && (mode !== 'search' || query.length > 0) && <Text $tone="muted">Загрузка…</Text>}
      {showEmpty && <Notice>{emptyText}</Notice>}
    </View>
  )

  const footer = active.hasMore && !active.failed ? (
    <Button variant="text" disabled={active.loading} onPress={active.loadMore}>
      {active.loading ? 'Загрузка…' : 'Показать ещё'}
    </Button>
  ) : (
    <View />
  )
  const common = {
    keyboardShouldPersistTaps: 'handled' as const,
    contentContainerStyle: { padding: 20, paddingTop: insets.top + TOP_CORNER, paddingBottom: 40, gap: GAP },
    onEndReached: active.loadMore,
    onEndReachedThreshold: 0.5,
    ListHeaderComponent: header,
    ListFooterComponent: footer,
  }

  return (
    // фон из темы: без него экран белый в тёмной теме
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {mode === 'media' && (
        <FlatList
          key="media"
          data={media.items ?? []}
          numColumns={COLUMNS}
          keyExtractor={(photo) => photo.id}
          columnWrapperStyle={{ gap: GAP }}
          {...common}
          renderItem={({ item, index }) => (
            <Pressable onPress={() => setViewing(index)} accessibilityRole="button" accessibilityLabel="Открыть фото">
              <CachedImage uri={item.thumbUrl} style={{ width: side, height: side, borderRadius: 8 }} contentFit="cover" />
            </Pressable>
          )}
        />
      )}
      {mode === 'links' && (
        <FlatList
          key="links"
          data={links.items ?? []}
          keyExtractor={(link, i) => `${link.messageId}:${link.url}:${i}`}
          {...common}
          contentContainerStyle={{ ...common.contentContainerStyle, gap: 10 }}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => void Linking.openURL(item.url).catch(() => {})}
              accessibilityRole="link"
              accessibilityLabel={`Открыть ссылку ${item.url}`}
              style={{ flexDirection: 'row', gap: 12, padding: 12, borderRadius: 14, borderWidth: 1, borderColor: colors.cardBorder, backgroundColor: colors.surface }}
            >
              <Ionicons name="link-outline" size={22} color={colors.accent} />
              <View style={{ flex: 1 }}>
                <Text $tone="accent" $weight="bold" numberOfLines={2}>
                  {item.url}
                </Text>
                <Text $size={12} $tone="muted">{`${nameOf(item.senderId)} · ${when(item.createdAt)}`}</Text>
              </View>
            </Pressable>
          )}
        />
      )}
      {mode === 'search' && (
        <FlatList
          key="search"
          data={found.items ?? []}
          keyExtractor={(message) => message.id}
          {...common}
          contentContainerStyle={{ ...common.contentContainerStyle, gap: 10 }}
          renderItem={({ item }) => (
            <View style={{ gap: 2, padding: 12, borderRadius: 14, borderWidth: 1, borderColor: colors.cardBorder, backgroundColor: colors.surface }}>
              <Text $size={12} $tone="muted">{`${nameOf(item.senderId)} · ${when(item.createdAt)}`}</Text>
              <Text numberOfLines={4}>{item.text}</Text>
            </View>
          )}
        />
      )}
      {viewing !== undefined && media.items && <PhotoViewer photos={media.items} index={viewing} onClose={() => setViewing(undefined)} />}
    </View>
  )
}
