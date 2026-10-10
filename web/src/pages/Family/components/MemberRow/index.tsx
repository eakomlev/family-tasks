import { Notice } from '@/components/Notice'
import { ROLE_LABELS } from '@/lib/roles'
import { Row } from './styles'
import type { MemberRowProps } from './types'

export function MemberRow({ member, isMe }: MemberRowProps) {
  return (
    <Row>
      <span>{member.name}{isMe && ' (вы)'}</span>
      <Notice as="span" $tone="muted">{ROLE_LABELS[member.role]}{member.isOwner && ' · создатель'}</Notice>
    </Row>
  )
}
