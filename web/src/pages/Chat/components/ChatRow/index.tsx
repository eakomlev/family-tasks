import { Avatar } from '@/components/Avatar'
import { Body, Bottom, Count, FamilyIcon, Name, Preview, Row, Time, Top } from '../../styles'
import type { ChatRowProps } from '../../types'
import { chatPreview, chatTitle, formatChatTime } from '../../utils'

// строка списка чатов: кто, последнее сообщение, время и число непрочитанных
export function ChatRow({ chat, member, members, me, now }: ChatRowProps) {
  const unread = chat.unread > 0

  return (
    <Row to={`/chat/${chat.id}`}>
      {member ? <Avatar name={member.name} seed={member.id} src={member.avatar} size="2.5rem" /> : <FamilyIcon aria-hidden>👨‍👩‍👧</FamilyIcon>}
      <Body>
        <Top>
          <Name $unread={unread}>{chatTitle(chat.id, members)}</Name>
          {chat.last && <Time $unread={unread}>{formatChatTime(chat.last.createdAt, now)}</Time>}
        </Top>
        <Bottom>
          <Preview $unread={unread}>{chatPreview(chat, me, members)}</Preview>
          {unread && <Count aria-label={`Непрочитанных: ${chat.unread}`}>{chat.unread > 99 ? '99+' : chat.unread}</Count>}
        </Bottom>
      </Body>
    </Row>
  )
}
