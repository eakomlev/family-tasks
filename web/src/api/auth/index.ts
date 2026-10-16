import { getCaptchaToken } from '@/lib/captcha'
import { request, send } from '../client'
import type { SessionResult } from '../families/types'
import type { CodePurpose } from './types'

// Код на почту отправляется после проверки капчей (если она включена): токен берётся при каждой отправке, в том числе при повторной
export async function requestEmailCode(email: string, purpose: CodePurpose) {
  const captchaToken = await getCaptchaToken()
  return request<void>('/email-codes', send('POST', captchaToken ? { email, purpose, captchaToken } : { email, purpose }))
}

export const login = (email: string, code: string, memberId?: string) =>
  request<SessionResult>('/auth/login', send('POST', { email, code, memberId }))

export const logout = (token: string) => request<void>('/session', send('DELETE'), token)

export type * from './types'
