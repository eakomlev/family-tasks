import { View } from 'react-native'
import { useChats } from '@/chat/context'
import { Notice } from '@/components/Notice'
import { PageHeader } from '@/components/PageHeader'
import { Screen } from '@/components/Screen'
import { Text } from '@/components/Text'
import { useIdentity } from '@/identity/context'
import { useNow } from '@/lib/useNow'
import { useProfile } from '@/profile/context'
import { ChatRow } from './ChatListScreen'

// Архив чатов: сюда уходят чаты, убранные из списка («В архив» в меню чата или при долгом нажатии). Они остаются живыми:
// писать в них можно, сообщения и уведомления приходят как обычно. Вернуть чат в список можно тем же меню.
export function ChatArchiveScreen() {
  const { identity } = useIdentity()
  const { data } = useProfile()
  const { chats } = useChats()
  const now = useNow()
  const members = data?.members ?? []
  const archived = chats?.filter((c) => c.archived) ?? []

  return (
    <Screen header={<PageHeader fallback="/chat">Архив</PageHeader>}>
      {!chats && <Text $tone="muted">Загрузка…</Text>}
      {chats && archived.length === 0 && <Notice>В архиве пока ничего нет. Чат можно убрать сюда долгим нажатием на него в списке.</Notice>}
      {archived.length > 0 && identity && (
        <View>
          {archived.map((chat) => (
            <ChatRow key={chat.id} chat={chat} member={members.find((m) => m.id === chat.id)} members={members} me={identity.memberId} viewerRole={identity.role} now={now} />
          ))}
        </View>
      )}
    </Screen>
  )
}
