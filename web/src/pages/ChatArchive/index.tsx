import { useChats } from '@/chat/context'
import { Notice } from '@/components/Notice'
import { Page } from '@/components/Page'
import { PageHeader } from '@/components/PageHeader'
import { useIdentity } from '@/identity/context'
import { useNow } from '@/lib/useNow'
import { ChatRow } from '@/pages/Chat/components/ChatRow'
import { List } from '@/pages/Chat/styles'
import { useProfile } from '@/profile/context'

// Архив чатов: скрытые из списка переписки (только у меня), писать в них можно по-прежнему.
export default function ChatArchive() {
  const { identity } = useIdentity()
  const { data } = useProfile()
  const { chats } = useChats()
  const now = useNow()
  const members = data?.members ?? []
  const archived = chats?.filter((chat) => chat.archived) ?? []

  return (
    <Page>
      <PageHeader to="/chat">Архив</PageHeader>
      {!chats && <p>Загрузка…</p>}
      {chats && archived.length === 0 && <Notice $tone="muted">В архиве пусто. Чат можно убрать в архив из его меню.</Notice>}
      {identity && archived.length > 0 && (
        <List>
          {archived.map((chat) => (
            <li key={chat.id}>
              <ChatRow chat={chat} member={members.find((m) => m.id === chat.id)} members={members} me={identity.memberId} viewerRole={identity.role} now={now} />
            </li>
          ))}
        </List>
      )}
    </Page>
  )
}
