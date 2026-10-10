import { Avatar } from '@/components/Avatar'
import { Notice } from '@/components/Notice'
import { ROLE_LABELS } from '@/lib/roles'
import { Card, Name, Row } from './styles'
import type { MemberRowProps } from './types'

export function MemberRow({ member, isMe }: MemberRowProps) {
  return (
    <Row>
      <Card to={isMe ? '/profile' : `/family/${member.id}`}>
        <Avatar name={member.name} seed={member.id} src={member.avatar} size="2.25rem" />
        <Name>{member.name}{isMe && ' (вы)'}</Name>
        <Notice as="span" $tone="muted">{ROLE_LABELS[member.role]}{member.isOwner && ' · создатель'}</Notice>
      </Card>
    </Row>
  )
}
