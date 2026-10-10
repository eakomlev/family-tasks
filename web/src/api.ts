import type { Role } from './roles'

export interface Member {
  id: string
  name: string
  role: Role
  isOwner: boolean
}

export class ApiError extends Error {
  status: number
  code: string
  body: unknown

  constructor(status: number, code: string, body: unknown = {}) {
    super(code)
    this.status = status
    this.code = code
    this.body = body
  }
}

async function request<T>(path: string, init: RequestInit = {}, token?: string): Promise<T> {
  const headers = new Headers(init.headers)
  if (init.body) headers.set('Content-Type', 'application/json')
  if (token) headers.set('Authorization', `Bearer ${token}`)

  let res: Response
  try {
    res = await fetch(`/api${path}`, { ...init, headers })
  } catch {
    throw new ApiError(0, 'network')
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new ApiError(res.status, body.error ?? 'unknown', body)
  }
  return res.status === 204 ? (undefined as T) : res.json()
}

const send = (method: string, body?: unknown): RequestInit => ({
  method,
  body: body === undefined ? undefined : JSON.stringify(body),
})

export interface Link {
  code: string
  expiresAt: string
}

export interface SessionResult {
  family: { code: string }
  member: Member & { token: string }
}

export interface SignupData {
  role: Role
  name: string
  email: string
  code: string
}

export type CodePurpose = 'signup' | 'login'

export const requestEmailCode = (email: string, purpose: CodePurpose) =>
  request<void>('/email-codes', send('POST', { email, purpose }))

export const createFamily = (data: SignupData) =>
  request<SessionResult & { invite: Link }>('/families', send('POST', data))

export const checkInvite = (code: string) =>
  request<{ expiresAt: string }>(`/invites/${encodeURIComponent(code)}`)

export const joinFamily = (inviteCode: string, data: SignupData) =>
  request<SessionResult>(`/invites/${encodeURIComponent(inviteCode)}/join`, send('POST', data))

export interface LoginOption {
  id: string
  name: string
  role: Role
  familyCode: string
  familyMembers: string[]
}

export const login = (email: string, code: string, memberId?: string) =>
  request<SessionResult>('/auth/login', send('POST', { email, code, memberId }))

export const logout = (token: string) => request<void>('/session', send('DELETE'), token)

export const getMe = (token: string) =>
  request<{ member: Member & { email: string }; family: { code: string }; members: Member[] }>(
    '/me',
    {},
    token,
  )

export const getInvite = (token: string) => request<Link>('/invite', {}, token)

export const renewInvite = (token: string) => request<Link>('/invite', send('POST'), token)
