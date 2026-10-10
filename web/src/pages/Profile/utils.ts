import { ImageError } from '@/lib/image'

export function describePhotoError(err: unknown): string {
  if (err instanceof ImageError) {
    if (err.reason === 'not_image') return 'Выберите файл с изображением.'
    if (err.reason === 'too_large') return 'Файл слишком большой. Выберите фото поменьше.'
    return 'Не удалось прочитать это изображение. Попробуйте другое.'
  }
  return 'Не удалось сохранить фото. Попробуйте ещё раз.'
}
