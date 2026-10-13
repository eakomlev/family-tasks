import { ApiError } from '@/api'
import { ImageError } from '@/lib/image'

export function describeCodeError(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.code === 'too_soon') return 'Код уже отправлен. Подождите минуту и попробуйте снова.'
    if (err.code === 'network') return 'Нет связи с сервером. Попробуйте ещё раз.'
    if (err.code === 'mail_busy') return MAIL_BUSY_TEXT
  }
  return 'Не удалось отправить код. Проверьте email и попробуйте ещё раз.'
}

// Дневной лимит писем исчерпан: код не придёт, пока он не освободится.
const MAIL_BUSY_TEXT = 'Сервис отправки писем сейчас перегружен. Попробуйте позже.'

// Повторная отправка кода: email уже проверен, поэтому общий текст другой, а понятные причины показываем как есть.
export function describeResendError(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.code === 'too_soon') return 'Код уже отправлен. Подождите минуту и попробуйте снова.'
    if (err.code === 'network') return 'Нет связи с сервером. Попробуйте ещё раз.'
    if (err.code === 'mail_busy') return MAIL_BUSY_TEXT
  }
  return 'Не удалось отправить код. Попробуйте позже.'
}

export const isTooSoon = (err: unknown) => err instanceof ApiError && err.code === 'too_soon'

// Ошибки отправки фото в чат: подготовка на устройстве (ImageError) и ответы сервера.
export function describePhotoError(err: unknown): string {
  if (err instanceof ImageError) {
    if (err.reason === 'not_image') return 'Это не фотография. Выберите изображение.'
    if (err.reason === 'too_large') return 'Фото слишком большое.'
    return 'Не удалось открыть фото. Попробуйте другое.'
  }
  if (err instanceof ApiError) {
    if (err.code === 'network') return 'Нет связи с сервером. Попробуйте ещё раз.'
    if (err.code === 'media_quota') return 'Место для фото у семьи закончилось.'
    if (err.code === 'media_disabled') return 'Отправка фото пока не включена.'
    if (err.code === 'media_unavailable') return 'Сервис фото сейчас недоступен. Попробуйте позже.'
    if (err.status === 413) return 'Фото слишком большое.'
    if (err.code === 'invalid_media') return 'Не удалось принять это фото.'
  }
  return 'Не удалось загрузить фото. Попробуйте ещё раз.'
}
