import { ApiError } from './api'

export function describeCodeError(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.code === 'too_soon') return 'Код уже отправлен. Подождите минуту и попробуйте снова.'
    if (err.code === 'network') return 'Нет связи с сервером. Попробуйте ещё раз.'
  }
  return 'Не удалось отправить код. Проверьте email и попробуйте ещё раз.'
}

export const isTooSoon = (err: unknown) => err instanceof ApiError && err.code === 'too_soon'
