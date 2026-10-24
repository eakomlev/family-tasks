import { MenuButton } from '@/components/PopupMenu'
import { Notice } from '@/components/Notice'
import { Page } from '@/components/Page'
import { useNavigate } from 'react-router-dom'
import { useChats } from '@/chat/context'
import { useIdentity } from '@/identity/context'
import { useNow } from '@/lib/useNow'
import { useProfile } from '@/profile/context'
import { ChatRow } from './components/ChatRow'
import { Ghost, Header, List } from './styles'

// Список чатов: общий чат семьи и по одному с каждым участником; сверху те, где недавно писали.
export default function Chat() {
  const { identity } = useIdentity()
  const { data } = useProfile()
  const { chats } = useChats()
  const now = useNow()
  const navigate = useNavigate()
  const members = data?.members ?? []

  return (
    <Page>
      <Header>
        <h1>Чат</h1>
        <MenuButton actions={[{ key: 'archive', label: 'Архив', onSelect: () => navigate('/chat/archive') }]} />
      </Header>
      {/* пока список грузится, на его месте серые строки */}
      {!chats && (
        <List role="status" aria-busy="true" aria-label="Загрузка чатов">
          {[0, 1, 2, 3, 4].map((i) => (
            <Ghost key={i} aria-hidden>
              <span />
              <div>
                <span />
                <span />
              </div>
            </Ghost>
          ))}
        </List>
      )}
      {chats && members.length === 0 && <Notice $tone="muted">В семье пока никого нет.</Notice>}
      {chats && members.length > 0 && identity && (
        <List>
          {chats.filter((chat) => !chat.archived).map((chat) => (
            <li key={chat.id}>
              <ChatRow
                chat={chat}
                member={members.find((m) => m.id === chat.id)}
                members={members}
                me={identity.memberId}
                viewerRole={identity.role}
                now={now}
              />
            </li>
          ))}
        </List>
      )}
    </Page>
  )
}
