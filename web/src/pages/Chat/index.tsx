import { Notice } from '@/components/Notice'
import { Page } from '@/components/Page'
import { useChats } from '@/chat/context'
import { useIdentity } from '@/identity/context'
import { useNow } from '@/lib/useNow'
import { useProfile } from '@/profile/context'
import { ChatRow } from './components/ChatRow'
import { List } from './styles'

// Список чатов: общий чат семьи и по одному с каждым участником; сверху те, где недавно писали.
export default function Chat() {
  const { identity } = useIdentity()
  const { data } = useProfile()
  const { chats } = useChats()
  const now = useNow()
  const members = data?.members ?? []

  return (
    <Page>
      <h1>Чат</h1>
      {!chats && <p>Загрузка…</p>}
      {chats && members.length === 0 && <Notice $tone="muted">В семье пока никого нет.</Notice>}
      {chats && members.length > 0 && identity && (
        <List>
          {chats.map((chat) => (
            <li key={chat.id}>
              <ChatRow
                chat={chat}
                member={members.find((m) => m.id === chat.id)}
                members={members}
                me={identity.memberId}
                now={now}
              />
            </li>
          ))}
        </List>
      )}
    </Page>
  )
}
