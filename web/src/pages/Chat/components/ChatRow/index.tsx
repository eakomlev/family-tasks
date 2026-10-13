import { Avatar } from '@/components/Avatar'
import { TabIcon } from '@/components/TabBar/TabIcon'
import { MoodMark } from '@/components/MoodMark'
import { Body, Bottom, Count, FamilyIcon, Name, Preview, Prefix, Row, Time, Top } from '../../styles'
import type { ChatRowProps } from '../../types'
import { memberLabel } from '@/lib/roles'
import { chatPreviewParts, chatTitle, formatChatTime } from '../../utils'

// строка списка чатов: кто, последнее сообщение, время и число непрочитанных
export function ChatRow({ chat, member, members, me, viewerRole, now }: ChatRowProps) {
  const unread = chat.unread > 0
  const preview = chatPreviewParts(chat, me, members, viewerRole)

  return (
    <Row to={`/chat/${chat.id}`}>
      {member ? <Avatar name={memberLabel(member, viewerRole)} seed={member.id} src={member.avatar} size="3.4rem" /> : <FamilyIcon aria-hidden><TabIcon name="family" /></FamilyIcon>}
      <Body>
        <Top>
          <Name $unread={unread}>{chatTitle(chat.id, members, viewerRole)}{member && <> <MoodMark mood={member.mood} now={now} /></>}</Name>
          {chat.last && <Time $unread={unread}>{formatChatTime(chat.last.createdAt, now)}</Time>}
        </Top>
        <Bottom>
          <Preview $unread={unread}>
            {preview.prefix && <Prefix $mine={preview.mine}>{preview.prefix} </Prefix>}
            {preview.text}
          </Preview>
          {unread && <Count aria-label={`Непрочитанных: ${chat.unread}`}>{chat.unread > 99 ? '99+' : chat.unread}</Count>}
        </Bottom>
      </Body>
    </Row>
  )
}
