export interface OutgoingMessage {
  // подпись или текст (после обрезки), может быть пустым, если есть фото
  text: string
  // загруженные фото в порядке показа
  mediaIds: string[]
}

export interface ComposerProps {
  // отправляет сообщение; должен бросить ошибку, если не вышло (текст и фото тогда остаются в поле)
  onSend: (message: OutgoingMessage) => Promise<void>
  // загружает одно уже уменьшенное фото и возвращает его идентификатор; бросает ошибку, если не вышло
  onUpload: (photo: Blob) => Promise<string>
}

// Фото, приложенное к сообщению, на пути от выбора до отправки.
export interface Attachment {
  key: string
  // локальный адрес для превью (blob:), освобождается при удалении и отправке
  preview: string
  status: 'uploading' | 'done' | 'failed'
  mediaId?: string
  error?: string
  // уменьшенный файл остаётся, чтобы повторить загрузку без повторного выбора (нет, если не удалось подготовить)
  retryable?: boolean
}
