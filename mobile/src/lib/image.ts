// Ошибки подготовки фото на устройстве. Сама обрезка и сжатие (expo-image-manipulator) появятся вместе с профилем и чатами.
export class ImageError extends Error {
  reason: 'not_image' | 'too_large' | 'decode_failed'

  constructor(reason: ImageError['reason']) {
    super(reason)
    this.reason = reason
  }
}
