const MAX_SOURCE_BYTES = 15 * 1024 * 1024

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
