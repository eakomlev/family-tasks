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

export async function request<T>(path: string, init: RequestInit = {}, token?: string): Promise<T> {
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

export const send = (method: string, body?: unknown): RequestInit => ({
  method,
  body: body === undefined ? undefined : JSON.stringify(body),
})
