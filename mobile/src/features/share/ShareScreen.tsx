import { useMemo } from 'react'
import { Pressable, View } from 'react-native'
import { useRouter } from 'expo-router'
import { useIncomingShare } from 'expo-sharing'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from 'styled-components/native'
import { useChats } from '@/chat/context'
import { Avatar } from '@/components/Avatar'
import { Button } from '@/components/Button'
import { Notice } from '@/components/Notice'
import { PageHeader } from '@/components/PageHeader'
import { Screen } from '@/components/Screen'
import { Heading, Text } from '@/components/Text'
import { chatTitle } from '@/features/chat/listUtils'
import { useIdentity } from '@/identity/context'
import { classifyShared, describeShared, hasShared, setPendingShare } from '@/lib/incomingShare'
import { goBack } from '@/lib/navigation'
import { useProfile } from '@/profile/context'

// «Поделиться» из другого приложения: что получили и в какой чат это отправить. Выбранный чат открывается, а полученное
// (текст, фото, файлы) ложится в его поле ввода: можно дописать подпись и нажать «Отправить».
export function ShareScreen() {
  const router = useRouter()
  const { colors } = useTheme()
  const { identity } = useIdentity()
  const { data } = useProfile()
  const { chats } = useChats()
  const { resolvedSharedPayloads, sharedPayloads, isResolving, error, clearSharedPayloads } = useIncomingShare()

  const content = useMemo(() => classifyShared(resolvedSharedPayloads), [resolvedSharedPayloads])
  const members = data?.members ?? []

  if (!identity) return null

  const cancel = () => {
    clearSharedPayloads()
    goBack(router, '/chat')
  }

  const choose = (chat: string) => {
    setPendingShare(content)
    clearSharedPayloads()
    router.replace({ pathname: '/chat/[chat]', params: { chat } })
  }

  const nothing = sharedPayloads.length === 0 && !isResolving
  const failed = !!error || (!isResolving && sharedPayloads.length > 0 && !hasShared(content))

  return (
    <Screen header={<PageHeader fallback="/chat">Поделиться</PageHeader>}>
      {nothing && <Notice>Нечего отправлять. Выберите фото, файл или текст в другом приложении и нажмите «Поделиться».</Notice>}
      {isResolving && <Text $tone="muted">Читаю, чем вы поделились…</Text>}
      {failed && <Notice tone="error">Не удалось прочитать то, чем вы поделились.</Notice>}
      {hasShared(content) && (
        <>
          <View style={{ gap: 4, padding: 14, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}>
            <Text $tone="muted" $size={13}>
              Вы делитесь
            </Text>
            <Text $weight="extraBold">{describeShared(content)}</Text>
          </View>
          <Heading>В какой чат отправить?</Heading>
          <View>
            {(chats ?? []).map((chat) => {
              const member = members.find((m) => m.id === chat.id)
              const title = chatTitle(chat.id, members, identity.role, chat.event?.title)
              return (
                <Pressable key={chat.id} onPress={() => choose(chat.id)} accessibilityRole="button" accessibilityLabel={`Отправить в чат «${title}»`} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 }}>
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
        </>
      )}
      <Button onPress={cancel}>Отмена</Button>
    </Screen>
  )
}
