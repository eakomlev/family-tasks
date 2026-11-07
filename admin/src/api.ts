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

export interface Session {
  family: { code: string }
  member: { id: string; name: string; role: string; token: string }
}
export interface LoginOption { id: string; name: string; role: string; familyCode: string; familyMembers: string[] }
export interface ServiceStats {
  accounts: { total: number; today: number }
  families: { total: number; today: number }
  messages: { total: number; today: number }
}
export interface AdminStats {
  queue?: {
    notifier: { alive: boolean; instances: number; lastBeatSeconds: number | null }
    waiting: { email: number; push: number }; retrying: number; oldestSeconds: number | null
    mail: { usedToday: number; limit: number }
    today: { email: { sent: number; failed: number }; push: { sent: number; failed: number } }
    scheduler?: { alive: boolean; lastBeatSeconds: number | null; lastTickSeconds: number | null; lastSent: number | null; lastError: string | null }
    realtime?: { alive: boolean; lastBeatSeconds: number | null; connections: number }
  }
  media?: { configured: boolean; alive: boolean; photos: number; bytes: number; unattached: { photos: number; bytes: number }; quotaBytes: number; busiestFamilyBytes: number }
  sms?: {
    configured: boolean; balance: { amount: number | null; checkedSeconds: number | null; error: string | null }
    today: { sent: number; failed: number; spend: number }; week: { sent: number; failed: number; spend: number }
    days: { day: string; sent: number; failed: number; spend: number }[]; waiting: number; retrying: number; limit: number; usedToday: number
  }
}
export interface AccountSummary {
  id: string; name: string; email: string | null; phone: string | null; role: string; isOwner: boolean
  createdAt: string; blockedAt: string | null; accessBlocked: boolean
  family: { id: string; code: string; surname: string | null } | null
  familyDeletionRequestedAt: string | null
}
export interface AccountPage { items: AccountSummary[]; total: number; page: number; pageSize: number }
export interface AccountDetail extends Omit<AccountSummary, 'family'> {
  avatar: string | null; birthDate: string | null; mood: { value: number; at: string } | null
  consentVersion: string | null; consentAt: string | null; familyId: string | null; familyCode: string | null; familySurname: string | null
  sessionCount: number; lastSeenAt: string | null; pushCount: number
  tasksCreated: number; tasksAssigned: number; tasksCompleted: number; messagesSent: number
  eventsCreated: number; goals: number; games: number; coinTransactions: number
  relatedAccounts: { id: string; name: string; role: string; isOwner: boolean; email: string | null; phone: string | null; createdAt: string; accessBlocked: boolean; familyCode: string | null; familySurname: string | null }[]
  familyMembers: { id: string; name: string; role: string; isOwner: boolean; email: string | null; phone: string | null; createdAt: string; accessBlocked: boolean }[]
}

async function request<T>(path: string, method: string, body?: unknown, token?: string): Promise<T> {
  const headers = new Headers()
  if (body !== undefined) headers.set('Content-Type', 'application/json')
  if (token) headers.set('Authorization', `Bearer ${token}`)
  let response: Response
  try { response = await fetch(`/api${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) }) }
  catch { throw new ApiError(0, 'network') }
  if (!response.ok) {
    const data = await response.json().catch(() => ({})) as { error?: string }
    throw new ApiError(response.status, data.error ?? 'unknown', data)
  }
  return response.status === 204 ? undefined as T : response.json() as Promise<T>
}
export const get = <T>(path: string, token: string) => request<T>(path, 'GET', undefined, token)
export const post = <T = void>(path: string, body: unknown) => request<T>(path, 'POST', body)
export const revokeSession = (token: string) => request<void>('/session', 'DELETE', undefined, token)
export const patch = <T = void>(path: string, body: unknown, token: string) => request<T>(path, 'PATCH', body, token)
export const del = <T = void>(path: string, token: string) => request<T>(path, 'DELETE', undefined, token)
