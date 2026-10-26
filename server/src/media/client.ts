import http from 'node:http'
import https from 'node:https'
import { pipeline, type Readable } from 'node:stream'

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
  // Тело идёт потоком (не лежит в памяти целиком), length это его размер в байтах (Content-Length запроса).
  uploadVideo(family: string, id: string, body: Readable, length: number, contentType: string): Promise<VideoUploadResult>
  // кладёт обычный файл как есть (документ, архив…); возвращает его размер
  uploadFile(family: string, id: string, body: Readable, length: number): Promise<{ size: number }>
  // удаляет файл (повтор безопасен)
  delete(family: string, id: string): Promise<void>
  // отвечает ли сервис и доступно ли его хранилище (для страницы «Сервис»); не бросает ошибок
  health(): Promise<boolean>
}

// Сервис media отклонил файл (не JPEG, битый): это ошибка клиента, а не сбой.
export class MediaRejected extends Error {
  // что именно не так, как отвечает сервис media: invalid_image, invalid_video, video_too_long, video_failed
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

// PUT с телом-потоком известной длины (fetch с потоком в Node требует лишних настроек, а здесь нужен точный Content-Length).
// timeoutMs это пауза без обмена данными: у видео после загрузки сервис media долго сжимает и молчит.
function putStream(base: string, path: string, headers: Record<string, string>, body: Readable, length: number, timeoutMs: number, token: string): Promise<{ status: number; text: string }> {
  return new Promise((resolve, reject) => {
    const url = new URL(path, base)
    const client = url.protocol === 'https:' ? https : http
    const req = client.request(url, { method: 'PUT', headers: { ...headers, 'content-length': String(length), 'x-internal-token': token }, timeout: timeoutMs }, (res) => {
      const chunks: Buffer[] = []
      res.on('data', (c: Buffer) => chunks.push(c))
      res.on('end', () => resolve({ status: res.statusCode ?? 0, text: Buffer.concat(chunks).toString('utf8') }))
      res.on('error', reject)
    })
    req.on('timeout', () => req.destroy(new Error('media timeout')))
    req.on('error', reject)
    pipeline(body, req, (err) => {
      if (err) reject(err)
    })
  })
}

const parseJson = <T>(text: string): T | Record<string, never> => {
  try {
    return JSON.parse(text) as T
  } catch {
    return {}
  }
}

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
    async uploadVideo(family, id, body, length, contentType) {
      const res = await putStream(config.url, `/internal/videos/${family}/${id}`, { 'content-type': contentType }, body, length, videoTimeoutMs, config.internalToken)
      if (res.status === 422) {
        const { error } = parseJson<{ error?: string }>(res.text)
        throw new MediaRejected(error === 'video_too_long' || error === 'video_failed' ? error : 'invalid_video')
      }
      if (res.status < 200 || res.status >= 300) throw new Error(`media video upload failed: ${res.status}`)
      return parseJson<VideoUploadResult>(res.text) as VideoUploadResult
    },
    async uploadFile(family, id, body, length) {
      const res = await putStream(config.url, `/internal/files/${family}/${id}`, { 'content-type': 'application/octet-stream' }, body, length, Math.max(timeoutMs, 60_000), config.internalToken)
      if (res.status < 200 || res.status >= 300) throw new Error(`media file upload failed: ${res.status}`)
      return parseJson<{ size: number }>(res.text) as { size: number }
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
