import { useRef, useState, type MouseEvent } from 'react'
import { Avatar } from '@/components/Avatar'
import { ReadTicks } from '@/components/ReadTicks'
import { TabIcon } from '@/components/TabBar/TabIcon'
import { MoodMark } from '@/components/MoodMark'
import { useLongPress } from '@/lib/useLongPress'
import { Body, Bottom, Count, FamilyIcon, Meta, MutedMark, Name, Preview, Prefix, Row, Status, Time, Top } from '../../styles'
import { ChatMenu } from '../ChatMenu'
import type { ChatRowProps } from '../../types'
import { memberLabel } from '@/lib/roles'
import { chatPreviewParts, chatTitle, formatChatTime, lastMessageStatus } from '../../utils'

// строка списка чатов: кто, последнее сообщение, время и число непрочитанных
export function ChatRow({ chat, member, members, me, viewerRole, now }: ChatRowProps) {
  const unread = chat.unread > 0
  const preview = chatPreviewParts(chat, me, members, viewerRole)
  const muted = chat.muted === true
  const status = lastMessageStatus(chat, me)

  // долгое нажатие открывает меню чата; «клик» после него (палец отпускается над ссылкой) переход не делает
  const [menu, setMenu] = useState(false)
  const lastLong = useRef(0)
  const press = useLongPress(() => {
    lastLong.current = Date.now()
    setMenu(true)
  })
  const onClick = (e: MouseEvent) => {
    if (Date.now() - lastLong.current < 700) e.preventDefault()
  }

  return (
    <>
    <Row to={`/chat/${chat.id}`} onClick={onClick} {...press}>
      {member ? (
        <Avatar name={memberLabel(member, viewerRole)} seed={member.id} src={member.avatar} size="3.4rem" />
      ) : chat.event ? (
        <FamilyIcon aria-hidden>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="4" y="5.5" width="16" height="14" rx="2.5" />
            <path d="M4 10h16M9 3.5v4M15 3.5v4" />
          </svg>
        </FamilyIcon>
      ) : (
        <FamilyIcon aria-hidden><TabIcon name="family" /></FamilyIcon>
      )}
      <Body>
        <Top>
          <Name $unread={unread}>{chatTitle(chat.id, members, viewerRole, chat.event?.title)}{muted && <MutedMark aria-label="Уведомления отключены" />}{member && <> <MoodMark mood={member.mood} now={now} /></>}</Name>
          {chat.last && (
            <Meta>
              {status && <Status $read={status === 'read'}><ReadTicks status={status} /></Status>}
              <Time $unread={unread}>{formatChatTime(chat.last.createdAt, now)}</Time>
            </Meta>
          )}
        </Top>
        <Bottom>
          <Preview $unread={unread}>
            {preview.prefix && <Prefix $mine={preview.mine}>{preview.prefix} </Prefix>}
            {preview.text}
          </Preview>
          {unread && <Count $muted={muted} aria-label={`Непрочитанных: ${chat.unread}`}>{chat.unread > 99 ? '99+' : chat.unread}</Count>}
        </Bottom>
      </Body>
    </Row>
    {menu && <ChatMenu chat={chat.id} onClose={() => setMenu(false)} />}
    </>
  )
}
