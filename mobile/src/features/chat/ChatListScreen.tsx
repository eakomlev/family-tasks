import { useState } from 'react'
import { Pressable, View } from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import styled, { useTheme } from 'styled-components/native'
import type { ChatSummary, Member } from '@/api'
import { useChats } from '@/chat/context'
import { ActionSheet } from '@/components/ActionSheet'
import { Avatar } from '@/components/Avatar'
import { Notice } from '@/components/Notice'
import { Screen } from '@/components/Screen'
import { Text, PageTitle } from '@/components/Text'
import { useIdentity } from '@/identity/context'
import { currentMood } from '@/lib/mood'
import { memberLabel, type Role } from '@/lib/roles'
import { useNow } from '@/lib/useNow'
import { useProfile } from '@/profile/context'
import { ReadTicks } from './ReadTicks'
import { chatPreviewParts, chatTitle, formatChatTime, lastMessageStatus } from './listUtils'
import { useChatActions } from './useChatActions'

const FamilyIcon = styled.View`
  width: 54px;
  height: 54px;
  border-radius: 27px;
  align-items: center;
  justify-content: center;
  background-color: ${({ theme }) => theme.colors.accentSoft};
`

const Count = styled.View<{ $muted: boolean }>`
  min-width: 22px;
  height: 22px;
  padding-horizontal: 6px;
  border-radius: 11px;
  align-items: center;
  justify-content: center;
  background-color: ${({ theme, $muted }) => ($muted ? theme.colors.muted : theme.colors.accent)};
`

// Меню чата из списка: долгое нажатие на строке
function RowMenu({ chat, onClose }: { chat: string; onClose: () => void }) {
  const actions = useChatActions(chat)
  return <ActionSheet actions={actions} onClose={onClose} />
}

// строка списка чатов: кто, последнее сообщение, время и число непрочитанных
function ChatRow({ chat, member, members, me, viewerRole, now }: { chat: ChatSummary; member?: Member; members: Member[]; me: string; viewerRole: Role; now: Date }) {
  const router = useRouter()
  const { colors } = useTheme()
  const unread = chat.unread > 0
  const preview = chatPreviewParts(chat, me, members, viewerRole)
  const muted = chat.muted === true
  const status = lastMessageStatus(chat, me)
  const mood = member ? currentMood(member.mood, now) : undefined
  const [menu, setMenu] = useState(false)

  return (
    <>
      <Pressable
        onPress={() => router.push({ pathname: '/chat/[chat]', params: { chat: chat.id } })}
        onLongPress={() => setMenu(true)}
        delayLongPress={450}
        accessibilityRole="button"
        style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 }}
      >
        {member ? (
          <Avatar name={memberLabel(member, viewerRole)} seed={member.id} src={member.avatar} size={54} />
        ) : (
          <FamilyIcon>
            <Ionicons name="people" size={26} color={colors.accent} />
          </FamilyIcon>
        )}
        <View style={{ flex: 1, gap: 2 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text $weight={unread ? 'black' : 'extraBold'} $size={16} style={{ flexShrink: 1 }} numberOfLines={1}>
              {chatTitle(chat.id, members, viewerRole)}
            </Text>
            {muted && <Ionicons name="notifications-off-outline" size={14} color={colors.muted} />}
            {mood && <Text $size={14}>{mood.emoji}</Text>}
            <View style={{ flex: 1 }} />
            {status && <ReadTicks status={status} color={status === 'read' ? colors.accent : colors.muted} />}
            {chat.last && (
              <Text $size={12} $weight={unread ? 'bold' : 'regular'} $tone={unread ? 'accent' : 'muted'}>
                {formatChatTime(chat.last.createdAt, now)}
              </Text>
            )}
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text $size={14} $tone="muted" numberOfLines={1} style={{ flex: 1 }}>
              {preview.prefix ? <Text $size={14} $weight="bold" $tone={preview.mine ? 'muted' : 'accent'}>{`${preview.prefix} `}</Text> : null}
              {preview.text}
            </Text>
            {unread && (
              <Count $muted={muted} accessibilityLabel={`Непрочитанных: ${chat.unread}`}>
                <Text $weight="black" $size={12} style={{ color: '#ffffff' }}>
                  {chat.unread > 99 ? '99+' : String(chat.unread)}
                </Text>
              </Count>
            )}
          </View>
        </View>
      </Pressable>
      {menu && <RowMenu chat={chat.id} onClose={() => setMenu(false)} />}
    </>
  )
}

// Список чатов: общий чат семьи и по одному с каждым участником; сверху те, где недавно писали
export function ChatListScreen() {
  const { identity } = useIdentity()
  const { data } = useProfile()
  const { chats } = useChats()
  const now = useNow()
  const members = data?.members ?? []

  return (
    <Screen bottomReserve={88}>
      <PageTitle>Чат</PageTitle>
      {!chats && <Text $tone="muted">Загрузка…</Text>}
      {chats && members.length === 0 && <Notice>В семье пока никого нет.</Notice>}
      {chats && members.length > 0 && identity && (
        <View>
          {chats.map((chat) => (
            <ChatRow key={chat.id} chat={chat} member={members.find((m) => m.id === chat.id)} members={members} me={identity.memberId} viewerRole={identity.role} now={now} />
          ))}
        </View>
      )}
    </Screen>
  )
}
