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

  constructor(status: number, code: string) {
    super(code)
    this.status = status
    this.code = code
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
    throw new ApiError(res.status, body.error ?? 'unknown')
  }
  return res.json()
}

const post = (body: unknown): RequestInit => ({ method: 'POST', body: JSON.stringify(body) })

export interface CreateFamilyResult {
  family: { code: string }
  member: Member & { token: string }
  invite: { code: string; expiresAt: string }
}

export const createFamily = (role: Role, name: string) =>
  request<CreateFamilyResult>('/families', post({ role, name }))

export const checkInvite = (code: string) =>
  request<{ expiresAt: string }>(`/invites/${encodeURIComponent(code)}`)

export const joinFamily = (inviteCode: string, role: Role, name: string) =>
  request<Omit<CreateFamilyResult, 'invite'>>(
    `/invites/${encodeURIComponent(inviteCode)}/join`,
    post({ role, name }),
  )

export const getMe = (token: string) =>
  request<{ member: Member; family: { code: string }; members: Member[] }>('/me', {}, token)

export interface Link {
  code: string
  expiresAt: string
}

export const getInvite = (token: string) => request<Link>('/invite', {}, token)

export const renewInvite = (token: string) => request<Link>('/invite', { method: 'POST' }, token)

export const createRecovery = (token: string, memberId: string) =>
  request<Link>(`/members/${encodeURIComponent(memberId)}/recovery`, { method: 'POST' }, token)

export const checkRecovery = (code: string) =>
  request<{ name: string; role: Role }>(`/recoveries/${encodeURIComponent(code)}`)

export const claimRecovery = (code: string) =>
  request<Omit<CreateFamilyResult, 'invite'>>(`/recoveries/${encodeURIComponent(code)}/claim`, {
    method: 'POST',
  })
