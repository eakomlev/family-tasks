import { ApiError } from '@/api'
import { ImageError } from '@/lib/image'

export function describePhotoError(err: unknown): string {
  if (err instanceof ImageError) {
    if (err.reason === 'no_permission') return 'Нет доступа к фотографиям. Разрешите его в настройках телефона.'
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

export function describeSaveError(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.code === 'name_taken') return 'В семье уже есть участник с таким именем. Выберите другое.'
    if (err.code === 'invalid_birth_date') return 'Укажите корректную дату рождения.'
  }
  return 'Не удалось сохранить. Попробуйте ещё раз.'
}
