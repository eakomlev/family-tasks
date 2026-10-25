// Клиент внутреннего API сервиса media (docs/chat-photos-plan.md). Интерфейс узкий, чтобы в тестах подставлять замену.
export interface UploadResult {
  width: number
  height: number
  size: number
  thumbSize: number
}

// Результат загрузки видео: размеры кадра после сжатия, длительность в секундах, размеры сжатого видео и превью в байтах.
export interface VideoUploadResult {
  width: number
  height: number
  duration: number
  size: number
  thumbSize: number
}

export interface MediaClient {
  // кладёт фото (JPEG); бросает MediaRejected, если сервис счёл файл негодным
  upload(family: string, id: string, body: Buffer): Promise<UploadResult>
  // отдаёт видео на сжатие и кладёт сжатое с превью; бросает MediaRejected (с кодом), если это не видео или оно слишком длинное
  uploadVideo(family: string, id: string, body: Buffer, contentType: string): Promise<VideoUploadResult>
  // кладёт обычный файл как есть (документ, архив…); возвращает его размер
  uploadFile(family: string, id: string, body: Buffer): Promise<{ size: number }>
  // удаляет файл (повтор безопасен)
  delete(family: string, id: string): Promise<void>
  // отвечает ли сервис и доступно ли его хранилище (для страницы «Сервис»); не бросает ошибок
  health(): Promise<boolean>
}

// Сервис media отклонил файл (не JPEG, битый): это ошибка клиента, а не сбой.
export class MediaRejected extends Error {
  // что именно не так, как отвечает сервис media: invalid_image, invalid_video, video_too_long
  constructor(readonly code = 'invalid_media') {
    super('media rejected the file')
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

// Сжатие видео занимает намного дольше загрузки фото: у него свой, длинный срок
const VIDEO_TIMEOUT_MS = 5 * 60_000

export function createMediaClient(config: Pick<MediaEnv, 'url' | 'internalToken'>, timeoutMs = 20_000, videoTimeoutMs = VIDEO_TIMEOUT_MS): MediaClient {
  const call = (path: string, init: RequestInit, timeout = timeoutMs) =>
    fetch(`${config.url}${path}`, {
      ...init,
      headers: { ...init.headers, 'x-internal-token': config.internalToken },
      signal: AbortSignal.timeout(timeout),
    })
  return {
    async upload(family, id, body) {
      const res = await call(`/internal/media/${family}/${id}`, { method: 'PUT', headers: { 'content-type': 'image/jpeg' }, body: new Uint8Array(body) })
      // 422 это «файл негодный», остальное (в том числе 401, 5xx) сбой сервиса
      if (res.status === 422) throw new MediaRejected()
      if (!res.ok) throw new Error(`media upload failed: ${res.status}`)
      return (await res.json()) as UploadResult
    },
    async uploadVideo(family, id, body, contentType) {
      const res = await call(`/internal/videos/${family}/${id}`, { method: 'PUT', headers: { 'content-type': contentType }, body: new Uint8Array(body) }, videoTimeoutMs)
      if (res.status === 422) {
        const { error } = (await res.json().catch(() => ({}))) as { error?: string }
        throw new MediaRejected(error === 'video_too_long' ? 'video_too_long' : 'invalid_video')
      }
      if (!res.ok) throw new Error(`media video upload failed: ${res.status}`)
      return (await res.json()) as VideoUploadResult
    },
    async uploadFile(family, id, body) {
      const res = await call(`/internal/files/${family}/${id}`, { method: 'PUT', headers: { 'content-type': 'application/octet-stream' }, body: new Uint8Array(body) }, Math.max(timeoutMs, 60_000))
      if (!res.ok) throw new Error(`media file upload failed: ${res.status}`)
      return (await res.json()) as { size: number }
    },
    async health() {
      try {
        // короткий срок: страница «Сервис» не должна ждать зависший сервис
        const res = await fetch(`${config.url}/health`, { signal: AbortSignal.timeout(Math.min(timeoutMs, 3000)) })
        return res.ok
      } catch {
        return false
      }
    },
    async delete(family, id) {
      const res = await call(`/internal/media/${family}/${id}`, { method: 'DELETE' })
      if (!res.ok && res.status !== 404) throw new Error(`media delete failed: ${res.status}`)
    },
  }
}
