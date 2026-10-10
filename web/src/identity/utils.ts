import type { SessionResult } from '@/api'
import type { Identity } from './types'

export const toIdentity = (res: SessionResult): Identity => ({
  familyCode: res.family.code,
  memberId: res.member.id,
  name: res.member.name,
  role: res.member.role,
  token: res.member.token,
})
