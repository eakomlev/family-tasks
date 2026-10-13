import { ApiError } from '@/api'

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
