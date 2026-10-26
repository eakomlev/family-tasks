import { getCaptchaToken } from '@/lib/captcha'
import { contactBody, type Contact } from '@/lib/contact'
import { request, send } from '../client'
import type { SessionResult } from '../families/types'
import type { CodePurpose } from './types'

// Код на почту или в SMS отправляется после проверки капчей (если она включена): токен берётся при каждой отправке, в том числе при повторной
export async function requestCode(contact: Contact, purpose: CodePurpose) {
  const captchaToken = await getCaptchaToken()
  const body = { ...contactBody(contact), purpose }
  return request<void>('/email-codes', send('POST', captchaToken ? { ...body, captchaToken } : body))
}

export const requestEmailCode = (email: string, purpose: CodePurpose) => requestCode({ kind: 'email', value: email }, purpose)

export const login = (contact: Contact, code: string, memberId?: string) =>
  request<SessionResult>('/auth/login', send('POST', { ...contactBody(contact), code, memberId }))

export const logout = (token: string) => request<void>('/session', send('DELETE'), token)

export type * from './types'
