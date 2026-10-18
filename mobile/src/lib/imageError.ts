// Ошибки подготовки фото на устройстве
export class ImageError extends Error {
  reason: 'not_image' | 'too_large' | 'decode_failed' | 'no_permission'

  constructor(reason: ImageError['reason']) {
    super(reason)
    this.reason = reason
  }
}
