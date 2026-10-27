import { useLocation, useSearchParams } from 'react-router-dom'
import { useChats } from '@/chat/context'
import { Avatar } from '@/components/Avatar'
import { Notice } from '@/components/Notice'
import { SlideInPage as Page } from '@/components/Page'
import { PageHeader } from '@/components/PageHeader'
import { TabIcon } from '@/components/TabBar/TabIcon'
import { useIdentity } from '@/identity/context'
import { memberLabel } from '@/lib/roles'
import { useProfile } from '@/profile/context'
import { chatTitle } from '@/pages/Chat/utils'
import { Body, FamilyIcon, List, Name, Row, Top } from '@/pages/Chat/styles'
import { Hint, Quote, Title } from './styles'

// «Поделиться» из других приложений (Web Share Target, Android) и пересылка сообщения из переписки: получили текст, выбираем чат.
// Выбранный чат открывается с этим текстом в поле ввода, дописать подпись и отправить можно сразу.
export default function Share() {
  const [params] = useSearchParams()
  const { identity } = useIdentity()
  const { data } = useProfile()
  const { chats } = useChats()
  // пересылка сообщения из переписки передаёт текст через состояние перехода, а «Поделиться» из других приложений через адрес
  const forwarded = (useLocation().state as { text?: string } | null)?.text
  const shared = forwarded ?? [params.get('title'), params.get('text'), params.get('url')].filter(Boolean).join('\n').trim()
  const members = data?.members ?? []

  return (
    <Page>
      <PageHeader to="/chat">{forwarded ? 'Переслать' : 'Поделиться'}</PageHeader>
      {!shared ? (
        <Notice $tone="muted">Нечего отправлять. Поделитесь текстом или ссылкой из другого приложения.</Notice>
      ) : (
        <>
          <Quote>{shared}</Quote>
          <Title>В какой чат отправить?</Title>
          {!chats && <p>Загрузка…</p>}
          {chats && identity && (
            <List>
              {chats.map((chat) => {
                const member = members.find((m) => m.id === chat.id)
                const title = chatTitle(chat.id, members, identity.role, chat.event?.title)
                return (
                  <li key={chat.id}>
                    <Row to={`/chat/${chat.id}`} state={{ share: shared }} replace aria-label={title}>
                      {member ? (
                        <Avatar name={memberLabel(member, identity.role)} seed={member.id} src={member.avatar} size="3.4rem" />
                      ) : (
                        <FamilyIcon aria-hidden>
                          {chat.event ? (
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <rect x="4" y="5.5" width="16" height="14" rx="2.5" />
                              <path d="M4 10h16M9 3.5v4M15 3.5v4" />
                            </svg>
                          ) : (
                            <TabIcon name="family" />
                          )}
                        </FamilyIcon>
                      )}
                      <Body>
                        <Top>
                          <Name $unread={false}>{title}</Name>
                          {chat.archived && <Hint>В архиве</Hint>}
                        </Top>
                      </Body>
                    </Row>
                  </li>
                )
              })}
            </List>
          )}
        </>
      )}
    </Page>
  )
}
