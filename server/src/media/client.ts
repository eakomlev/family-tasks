// Клиент внутреннего API сервиса media (docs/chat-photos-plan.md). Интерфейс узкий, чтобы в тестах подставлять замену.
export interface UploadResult {
  width: number
  height: number
  size: number
  thumbSize: number
}

export interface MediaClient {
  // кладёт фото (JPEG); бросает MediaRejected, если сервис счёл файл негодным
  upload(family: string, id: string, body: Buffer): Promise<UploadResult>
  // удаляет файл (повтор безопасен)
  delete(family: string, id: string): Promise<void>
}

// Сервис media отклонил файл (не JPEG, битый): это ошибка клиента, а не сбой.
export class MediaRejected extends Error {
  constructor() {
    super('media rejected the image')
    this.name = 'MediaRejected'
  }
}

export interface MediaEnv {
  url: string
  internalToken: string
  secret: string
}

// Настройки из окружения; null, если фото не настроены (тогда загрузка отвечает 503, а текст в чатах работает как раньше).
export function mediaEnv(env: NodeJS.ProcessEnv = process.env): MediaEnv | null {
  const { MEDIA_SECRET: secret, MEDIA_INTERNAL_TOKEN: internalToken } = env
  if (!secret || !internalToken) return null
  return { url: (env.MEDIA_URL || 'http://media:3000').replace(/\/$/, ''), internalToken, secret }
}

export function createMediaClient(config: Pick<MediaEnv, 'url' | 'internalToken'>, timeoutMs = 20_000): MediaClient {
  const call = (path: string, init: RequestInit) =>
    fetch(`${config.url}${path}`, {
      ...init,
      headers: { ...init.headers, 'x-internal-token': config.internalToken },
      signal: AbortSignal.timeout(timeoutMs),
    })
  return {
    async upload(family, id, body) {
      const res = await call(`/internal/media/${family}/${id}`, { method: 'PUT', headers: { 'content-type': 'image/jpeg' }, body: new Uint8Array(body) })
      // 422 это «файл негодный», остальное (в том числе 401, 5xx) сбой сервиса
      if (res.status === 422) throw new MediaRejected()
      if (!res.ok) throw new Error(`media upload failed: ${res.status}`)
      return (await res.json()) as UploadResult
    },
    async delete(family, id) {
      const res = await call(`/internal/media/${family}/${id}`, { method: 'DELETE' })
      if (!res.ok && res.status !== 404) throw new Error(`media delete failed: ${res.status}`)
    },
  }
}
