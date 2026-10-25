// Видео в чатах. Пределы повторяют сервер, чтобы человек сразу видел причину, а не ждал загрузки; настоящую проверку делают server и media.

export const MAX_VIDEOS = 3
export const MAX_VIDEO_BYTES = 100 * 1024 * 1024
export const MAX_VIDEO_SECONDS = 180

// «0:07», «2:05»
export function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.round(seconds))
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

// Почему видео нельзя отправить (текст для человека) или null, если можно. Длительность в миллисекундах (так её отдаёт выбор из галереи);
// не известна: решает сервер.
export function videoProblem(video: { size: number; durationMs?: number | null }): string | null {
  if (video.size === 0) return 'Видео пустое.'
  if (video.size > MAX_VIDEO_BYTES) return `Видео больше ${MAX_VIDEO_BYTES / (1024 * 1024)} МБ.`
  if (video.durationMs != null && video.durationMs / 1000 > MAX_VIDEO_SECONDS) return `Видео длиннее ${MAX_VIDEO_SECONDS / 60} минут.`
  return null
}

// Тип видео для загрузки: из выбора, а если его нет, по расширению
export function videoMimeType(name: string, mimeType?: string | null): string {
  if (mimeType?.startsWith('video/')) return mimeType
  return name.toLowerCase().endsWith('.mov') ? 'video/quicktime' : 'video/mp4'
}
