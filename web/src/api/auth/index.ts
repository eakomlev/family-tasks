import { request, send } from '../client'
import type { SessionResult } from '../families/types'
import type { CodePurpose } from './types'

export const requestEmailCode = (email: string, purpose: CodePurpose) =>
  request<void>('/email-codes', send('POST', { email, purpose }))

export const login = (email: string, code: string, memberId?: string) =>
  request<SessionResult>('/auth/login', send('POST', { email, code, memberId }))

export const logout = (token: string) => request<void>('/session', send('DELETE'), token)

export type * from './types'
