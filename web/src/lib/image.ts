const MAX_SOURCE_BYTES = 30 * 1024 * 1024

// Файл из data URL без `fetch`: запрос по `data:` запрещён правилом безопасности (CSP connect-src), а нам нужен только разбор base64
export function dataUrlToFile(dataUrl: string, name: string): File {
  const match = /^data:([^;,]+)(;base64)?,(.*)$/s.exec(dataUrl)
  if (!match) throw new ImageError('decode_failed')
  const [, type, base64, payload] = match
  const text = base64 ? atob(payload) : decodeURIComponent(payload)
  const bytes = new Uint8Array(text.length)
  for (let i = 0; i < text.length; i++) bytes[i] = text.charCodeAt(i)
  return new File([bytes], name, { type })
}

export class ImageError extends Error {
  reason: 'not_image' | 'too_large' | 'decode_failed'

  constructor(reason: ImageError['reason']) {
    super(reason)
    this.reason = reason
  }
}

// Обрезает фото до квадрата по центру и сжимает до size×size JPEG (около 5–10 КБ),
// чтобы его можно было хранить прямо в таблице участников.
export async function resizeToAvatar(file: File, size = 128, quality = 0.8): Promise<string> {
  if (!file.type.startsWith('image/')) throw new ImageError('not_image')
  if (file.size > MAX_SOURCE_BYTES) throw new ImageError('too_large')

  let bitmap: ImageBitmap
  try {
    // from-image учитывает поворот, записанный камерой телефона
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    throw new ImageError('decode_failed')
  }

  try {
    const side = Math.min(bitmap.width, bitmap.height)
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size

    const ctx = canvas.getContext('2d')
    if (!ctx) throw new ImageError('decode_failed')
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(
      bitmap,
      (bitmap.width - side) / 2,
      (bitmap.height - side) / 2,
      side,
      side,
      0,
      0,
      size,
      size,
    )
    return canvas.toDataURL('image/jpeg', quality)
  } finally {
    bitmap.close()
  }
}

// Фото для чата: длинная сторона до 1600 px, JPEG. Размер файла ограничен сервером (3 МБ): если он не помещается, снижаем качество.
export const PHOTO_MAX_SIDE = 1600
export const PHOTO_MAX_BYTES = 3 * 1024 * 1024 - 64 * 1024

export interface ResizedPhoto {
  blob: Blob
  width: number
  height: number
}

const canvasToBlob = (canvas: HTMLCanvasElement, quality: number) =>
  new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality))

// Уменьшает фото (без обрезки) и перекодирует в JPEG: заодно пропадает метка геопозиции, а поворот камеры применяется к пикселям.
export async function resizeToPhoto(file: File, maxSide = PHOTO_MAX_SIDE, quality = 0.82): Promise<ResizedPhoto> {
  if (!file.type.startsWith('image/')) throw new ImageError('not_image')
  if (file.size > MAX_SOURCE_BYTES) throw new ImageError('too_large')

  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    throw new ImageError('decode_failed')
  }

  try {
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
    const width = Math.max(1, Math.round(bitmap.width * scale))
    const height = Math.max(1, Math.round(bitmap.height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new ImageError('decode_failed')
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(bitmap, 0, 0, width, height)

    // обычно хватает первой попытки; очень «шумное» фото повторяем с меньшим качеством
    for (let q = quality; q >= 0.4; q -= 0.14) {
      const blob = await canvasToBlob(canvas, q)
      if (!blob) throw new ImageError('decode_failed')
      if (blob.size <= PHOTO_MAX_BYTES) return { blob, width, height }
    }
    throw new ImageError('too_large')
  } finally {
    bitmap.close()
  }
}
