// Видео в чатах. Пределы повторяют сервер, чтобы человек сразу видел причину, а не ждал загрузки; настоящую проверку делают server и media.

export const MAX_VIDEOS = 3
export const MAX_VIDEO_BYTES = 100 * 1024 * 1024
export const MAX_VIDEO_SECONDS = 180

// Видео ли это: по типу, а если браузер его не определил (часть Android и .mov), по расширению
const EXTENSIONS = new Set(['mp4', 'mov', 'm4v', 'webm', 'mkv', '3gp', 'avi'])
export function isVideoFile(file: { name: string; type: string }): boolean {
  if (file.type.startsWith('video/')) return true
  const dot = file.name.lastIndexOf('.')
  return !file.type && dot >= 0 && EXTENSIONS.has(file.name.slice(dot + 1).toLowerCase())
}

// Тип для заголовка загрузки: у видео без определённого типа берём по расширению
export function videoContentType(file: { name: string; type: string }): string {
  if (file.type.startsWith('video/')) return file.type
  return file.name.toLowerCase().endsWith('.mov') ? 'video/quicktime' : 'video/mp4'
}

// «0:07», «2:05»
export function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.round(seconds))
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

// Длительность видеофайла в секундах: читается из метаданных на устройстве; null, если браузер не смог (тогда решает сервер)
export function readVideoDuration(file: Blob, timeoutMs = 4000): Promise<number | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const el = document.createElement('video')
    const done = (value: number | null) => {
      clearTimeout(timer)
      URL.revokeObjectURL(url)
      el.removeAttribute('src')
      resolve(value)
    }
    const timer = setTimeout(() => done(null), timeoutMs)
    el.preload = 'metadata'
    el.muted = true
    el.onloadedmetadata = () => done(Number.isFinite(el.duration) ? el.duration : null)
    el.onerror = () => done(null)
    el.src = url
  })
}

// Почему видео нельзя отправить (текст для человека) или null, если можно. Длительность проверяется отдельно, когда известна.
export function videoProblem(file: { size: number }, duration: number | null): string | null {
  if (file.size === 0) return 'Видео пустое.'
  if (file.size > MAX_VIDEO_BYTES) return `Видео больше ${MAX_VIDEO_BYTES / (1024 * 1024)} МБ.`
  if (duration !== null && duration > MAX_VIDEO_SECONDS) return `Видео длиннее ${MAX_VIDEO_SECONDS / 60} минут.`
  return null
}
