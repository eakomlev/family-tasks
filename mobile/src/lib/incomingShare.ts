import type { ResolvedSharePayload } from 'expo-sharing'

// Что поделились с приложением из другого приложения («Поделиться» в галерее, браузере, мессенджере…), разобранное для чата:
// текст (в том числе ссылки), картинки, видео и остальные файлы.
export interface SharedFile {
  uri: string
  name: string
  size: number
}

export interface SharedContent {
  text: string
  images: SharedFile[]
  videos: SharedFile[]
  files: SharedFile[]
}

export const emptyShared = (): SharedContent => ({ text: '', images: [], videos: [], files: [] })

const lastPathPart = (uri: string) => decodeURIComponent(uri.split('?')[0].split('/').pop() ?? '') || 'Файл'

// Раскладывает полученное по видам. Текст и ссылки склеиваются через пустую строку, картинки идут как фото, видео как видео (сжатие и плеер),
// звук и документы как файлы.
export function classifyShared(payloads: ResolvedSharePayload[]): SharedContent {
  const content = emptyShared()
  const texts: string[] = []
  for (const payload of payloads) {
    if (payload.contentType === 'image' && payload.contentUri) {
      content.images.push({ uri: payload.contentUri, name: payload.originalName ?? lastPathPart(payload.contentUri), size: payload.contentSize ?? 0 })
    } else if (payload.contentType === 'video' && payload.contentUri) {
      content.videos.push({ uri: payload.contentUri, name: payload.originalName ?? lastPathPart(payload.contentUri), size: payload.contentSize ?? 0 })
    } else if ((payload.contentType === 'audio' || payload.contentType === 'file') && payload.contentUri) {
      content.files.push({ uri: payload.contentUri, name: payload.originalName ?? lastPathPart(payload.contentUri), size: payload.contentSize ?? 0 })
    } else {
      // текст и ссылки (в том числе «веб-страница»): сама ссылка лежит в value
      const value = (payload.value ?? '').trim()
      if (value) texts.push(value)
    }
  }
  content.text = texts.join('\n\n')
  return content
}

export const hasShared = (content: SharedContent) => content.text !== '' || content.images.length > 0 || content.videos.length > 0 || content.files.length > 0

// Короткое описание для экрана выбора чата: «Текст», «3 фото», «1 видео», «Файл: отчёт.pdf»
export function describeShared(content: SharedContent): string {
  const parts: string[] = []
  if (content.text) parts.push(content.text.length > 80 ? `${content.text.slice(0, 79).trim()}…` : content.text)
  if (content.images.length > 0) parts.push(content.images.length === 1 ? '1 фото' : `${content.images.length} фото`)
  if (content.videos.length > 0) parts.push(content.videos.length === 1 ? '1 видео' : `${content.videos.length} видео`)
  if (content.files.length > 0) parts.push(content.files.length === 1 ? `Файл: ${content.files[0].name}` : `Файлов: ${content.files.length}`)
  return parts.join(' · ')
}

// Выбранное отправляется не сразу: открывается переписка выбранного чата, а полученное ложится в её поле ввода (текст, фото, файлы),
// человек может дописать подпись и нажать «Отправить». Хранится только в памяти, до первого чтения.
let pending: SharedContent | null = null

export function setPendingShare(content: SharedContent | null) {
  pending = content
}

export function takePendingShare(): SharedContent | null {
  const content = pending
  pending = null
  return content
}
