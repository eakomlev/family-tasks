import { Pressable, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from 'styled-components/native'
import { useChats } from '@/chat/context'
import { Avatar } from '@/components/Avatar'
import { Text } from '@/components/Text'
import { chatTitle } from '@/features/chat/listUtils'
import { useIdentity } from '@/identity/context'
import { useProfile } from '@/profile/context'

// Список всех чатов (в том числе архивных и чатов событий) для выбора, куда отправить полученное или пересланное
export function ChatPicker({ onChoose }: { onChoose: (chat: string) => void }) {
  const { colors } = useTheme()
  const { identity } = useIdentity()
  const { data } = useProfile()
  const { chats } = useChats()
  const members = data?.members ?? []
  if (!identity) return null

  return (
    <View>
      {(chats ?? []).map((chat) => {
        const member = members.find((m) => m.id === chat.id)
        const title = chatTitle(chat.id, members, identity.role, chat.event?.title)
        return (
          <Pressable key={chat.id} onPress={() => onChoose(chat.id)} accessibilityRole="button" accessibilityLabel={`Отправить в чат «${title}»`} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 }}>
            {member ? (
              <Avatar name={title} seed={member.id} src={member.avatar} size={44} />
            ) : (
              <View style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accentSoft }}>
                <Ionicons name={chat.event ? 'calendar' : 'people'} size={22} color={colors.accent} />
              </View>
            )}
            <Text $weight="extraBold" style={{ flex: 1 }} numberOfLines={1}>
              {title}
            </Text>
            {chat.archived && (
              <Text $size={12} $tone="muted">
                В архиве
              </Text>
            )}
          </Pressable>
        )
      })}
    </View>
  )
}
