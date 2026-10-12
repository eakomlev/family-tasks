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

// Сколько раз повторять чтение, если сервер ответил 429 («слишком часто»), и как долго ждать не больше
const MAX_RATE_RETRIES = 2
const MAX_RETRY_WAIT_MS = 3000

// пауза из заголовка Retry-After (секунды), но не дольше разумного: страница не должна «висеть»
function retryDelay(res: Response, attempt: number): number {
  const seconds = Number(res.headers.get('Retry-After'))
  const wanted = Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : 500 * (attempt + 1)
  return Math.min(wanted, MAX_RETRY_WAIT_MS)
}

export async function request<T>(path: string, init: RequestInit = {}, token?: string): Promise<T> {
  const headers = new Headers(init.headers)
  if (init.body) headers.set('Content-Type', 'application/json')
  if (token) headers.set('Authorization', `Bearer ${token}`)
  // повторять можно только чтение: изменяющие запросы при 429 не выполнялись, но повтор решает пользователь
  const isRead = !init.method || init.method.toUpperCase() === 'GET'

  let res: Response
  for (let attempt = 0; ; attempt++) {
    try {
      res = await fetch(`/api${path}`, { ...init, headers })
    } catch {
      throw new ApiError(0, 'network')
    }
    if (res.status !== 429 || !isRead || attempt >= MAX_RATE_RETRIES) break
    await new Promise((resolve) => setTimeout(resolve, retryDelay(res, attempt)))
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
