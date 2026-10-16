import { ApiError } from '@/api'

// Тексты ошибок сохранения события
export function describeEventError(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.code === 'network') return 'Нет связи с сервером. Попробуйте ещё раз.'
    if (err.code === 'invalid_time') return 'Время окончания должно быть позже начала.'
    if (err.code === 'invalid_range') return 'Дата окончания раньше даты начала.'
    if (err.code === 'invalid_date') return 'Проверьте даты: допустимы годы с 2000 по 2100.'
    if (err.code === 'invalid_members') return 'Не удалось добавить участников. Обновите страницу и попробуйте ещё раз.'
    if (err.status === 403) return 'Менять событие может только его автор.'
  }
  return 'Не удалось сохранить событие. Попробуйте ещё раз.'
}
