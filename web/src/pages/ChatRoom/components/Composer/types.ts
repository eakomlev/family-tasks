export interface OutgoingMessage {
  // подпись или текст (после обрезки), может быть пустым, если есть фото
  text: string
  // загруженные фото в порядке показа
  mediaIds: string[]
  // загруженные файлы (документы, архивы…) в порядке показа
  fileIds: string[]
  // загруженные видео в порядке показа
  videoIds: string[]
}

export interface ComposerProps {
  // текст, который сразу ложится в поле (например, полученное через «Поделиться»)
  initialText?: string
  // отправляет сообщение; должен бросить ошибку, если не вышло (текст и фото тогда остаются в поле)
  onSend: (message: OutgoingMessage) => Promise<void>
  // загружает одно уже уменьшенное фото и возвращает его идентификатор; бросает ошибку, если не вышло
  onUpload: (photo: Blob) => Promise<string>
  // загружает один файл (не фото) и возвращает его идентификатор; бросает ошибку, если не вышло
  onUploadFile: (file: File) => Promise<string>
  // загружает одно видео (сервер сжимает его, это долго) и возвращает идентификатор; бросает ошибку, если не вышло.
  // Без этого видео из выбора отклоняются как «не поддерживается».
  onUploadVideo?: (video: File) => Promise<string>
  // отвечаем на сообщение: над полем цитата, отправка уйдёт ответом (сбрасывает ответ родитель после отправки)
  reply?: { name: string; text: string } | null
  onCancelReply?: () => void
  // правим своё сообщение: текст ложится в поле, вложений нет, отправка сохраняет правку (бросает ошибку, если не вышло)
  editing?: { id: string; text: string } | null
  onCancelEdit?: () => void
  onEditSubmit?: (text: string) => Promise<void>
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

// Файл (не фото), приложенный к сообщению, на пути от выбора до отправки.
export interface FileAttachment {
  key: string
  name: string
  size: number
  status: 'uploading' | 'done' | 'failed'
  fileId?: string
  error?: string
  // можно повторить загрузку (нет, если файл отклонён ещё на устройстве: слишком большой, запрещённый вид)
  retryable?: boolean
}

// Видео, приложенное к сообщению, на пути от выбора до отправки.
export interface VideoAttachment {
  key: string
  name: string
  size: number
  // локальный адрес для превью первого кадра (blob:), освобождается при удалении и отправке
  preview: string
  status: 'uploading' | 'done' | 'failed'
  videoId?: string
  error?: string
  // можно повторить загрузку (нет, если видео отклонено ещё на устройстве: слишком большое или длинное)
  retryable?: boolean
}
