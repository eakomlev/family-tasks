import { Link, useSearchParams } from 'react-router-dom'
import { useChats } from '@/chat/context'
import { Notice } from '@/components/Notice'
import { SlideInPage as Page } from '@/components/Page'
import { PageHeader } from '@/components/PageHeader'
import { useIdentity } from '@/identity/context'
import { useProfile } from '@/profile/context'
import { chatTitle } from '@/pages/Chat/utils'
import { List } from '@/pages/Chat/styles'

// «Поделиться» из других приложений (Web Share Target, Android): получили текст или ссылку, выбираем чат.
// Выбранный чат открывается с этим текстом в поле ввода, дописать подпись и отправить можно сразу.
export default function Share() {
  const [params] = useSearchParams()
  const { identity } = useIdentity()
  const { data } = useProfile()
  const { chats } = useChats()
  const shared = [params.get('title'), params.get('text'), params.get('url')].filter(Boolean).join('\n').trim()
  const members = data?.members ?? []

  return (
    <Page>
      <PageHeader to="/chat">Поделиться</PageHeader>
      {!shared ? (
        <Notice $tone="muted">Нечего отправлять. Поделитесь текстом или ссылкой из другого приложения.</Notice>
      ) : (
        <>
          <Notice $tone="muted">{shared}</Notice>
          <h2>В какой чат отправить?</h2>
          {!chats && <p>Загрузка…</p>}
          {chats && identity && (
            <List>
              {chats.map((chat) => (
                <li key={chat.id}>
                  <Link to={`/chat/${chat.id}`} state={{ share: shared }} replace>
                    {chatTitle(chat.id, members, identity.role, chat.event?.title)}
                  </Link>
                </li>
              ))}
            </List>
          )}
        </>
      )}
    </Page>
  )
}
