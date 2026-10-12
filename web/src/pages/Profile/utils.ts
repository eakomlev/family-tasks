import { ApiError } from '@/api'
import { ImageError } from '@/lib/image'

export function describePhotoError(err: unknown): string {
  if (err instanceof ImageError) {
    if (err.reason === 'not_image') return 'Выберите файл с изображением.'
    if (err.reason === 'too_large') return 'Файл слишком большой. Выберите фото поменьше.'
    return 'Не удалось прочитать это изображение. Попробуйте другое.'
  }
  if (err instanceof ApiError) {
    if (err.code === 'roblox_user_not_found') return 'Игрока с таким ником в Roblox нет. Проверьте ник.'
    if (err.code === 'roblox_unavailable') return 'Не удалось связаться с Roblox. Попробуйте позже.'
    if (err.code === 'network') return 'Нет связи с сервером. Попробуйте ещё раз.'
  }
  return 'Не удалось сохранить фото. Попробуйте ещё раз.'
}
