import { request, send } from '../client'
import type { SessionResult, SignupData } from '../families/types'
import type { Link } from './types'

export const checkInvite = (code: string) =>
  request<{ expiresAt: string }>(`/invites/${encodeURIComponent(code)}`)

export const joinFamily = (inviteCode: string, data: SignupData) =>
  request<SessionResult>(`/invites/${encodeURIComponent(inviteCode)}/join`, send('POST', data))

// действующее приглашение семьи и выпуск нового (только владелец)
export const getInvite = (token: string) => request<Link>('/invite', {}, token)

export const renewInvite = (token: string) => request<Link>('/invite', send('POST'), token)

export type * from './types'
