import { ApiError } from '@/api'
import { ImageError } from '@/lib/imageError'

export function describeCodeError(err: unknown): string {
  if (err instanceof ApiError) {
    const captcha = describeCaptchaError(err)
    if (captcha) return captcha
    if (err.code === 'too_soon') return 'Код уже отправлен. Подождите минуту и попробуйте снова.'
    if (err.code === 'network') return 'Нет связи с сервером. Попробуйте ещё раз.'
    if (err.code === 'mail_busy') return MAIL_BUSY_TEXT
    if (err.code === 'sms_busy') return SMS_BUSY_TEXT
    if (err.code === 'invalid_phone') return INVALID_PHONE_TEXT
  }
  return 'Не удалось отправить код. Проверьте email или номер и попробуйте ещё раз.'
}

// Проверка капчей: окно закрыли, не загрузилась или сервер не принял токен
function describeCaptchaError(err: ApiError): string | undefined {
  if (err.code === 'captcha_cancelled') return 'Проверка не пройдена. Попробуйте ещё раз.'
  if (err.code === 'captcha_unavailable') return 'Не удалось загрузить проверку. Проверьте соединение и попробуйте ещё раз.'
  if (err.code === 'captcha_failed' || err.code === 'captcha_required') return 'Проверка не пройдена. Попробуйте ещё раз.'
  return undefined
}

// Дневной лимит писем исчерпан: код не придёт, пока он не освободится.
const MAIL_BUSY_TEXT = 'Сервис отправки писем сейчас перегружен. Попробуйте позже.'
const SMS_BUSY_TEXT = 'Сервис отправки SMS сейчас перегружен. Попробуйте позже или войдите по email.'
export const INVALID_PHONE_TEXT = 'Введите российский мобильный номер, например +7 911 123-45-67.'

// Повторная отправка кода: email уже проверен, поэтому общий текст другой, а понятные причины показываем как есть.
export function describeResendError(err: unknown): string {
  if (err instanceof ApiError) {
    const captcha = describeCaptchaError(err)
    if (captcha) return captcha
    if (err.code === 'too_soon') return 'Код уже отправлен. Подождите минуту и попробуйте снова.'
    if (err.code === 'network') return 'Нет связи с сервером. Попробуйте ещё раз.'
    if (err.code === 'mail_busy') return MAIL_BUSY_TEXT
    if (err.code === 'sms_busy') return SMS_BUSY_TEXT
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

// Ошибки отправки файла в чат (не фото): ответы сервера.
export function describeFileError(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.code === 'network') return 'Нет связи с сервером. Попробуйте ещё раз.'
    if (err.code === 'file_type_blocked') return 'Такие файлы отправлять нельзя.'
    if (err.code === 'media_quota') return 'Место для файлов у семьи закончилось.'
    if (err.code === 'media_disabled') return 'Отправка файлов пока не включена.'
    if (err.code === 'media_unavailable') return 'Сервис файлов сейчас недоступен. Попробуйте позже.'
    if (err.status === 413) return 'Файл слишком большой.'
    if (err.code === 'invalid_file') return 'Не удалось принять этот файл.'
  }
  return 'Не удалось загрузить файл. Попробуйте ещё раз.'
}

// Ошибки загрузки видео
export function describeVideoError(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.code === 'network') return 'Нет связи с сервером. Попробуйте ещё раз.'
    if (err.code === 'video_too_long') return 'Видео длиннее 3 минут.'
    if (err.code === 'invalid_video') return 'Не удалось прочитать это видео. Попробуйте другое.'
    if (err.code === 'video_failed') return 'Не удалось обработать это видео. Попробуйте более короткое.'
    if (err.code === 'media_busy') return 'Сервер сейчас обрабатывает другие видео. Попробуйте через минуту.'
    if (err.code === 'media_quota') return 'Место для видео у семьи закончилось.'
    if (err.code === 'media_disabled') return 'Отправка видео пока не включена.'
    if (err.code === 'media_unavailable') return 'Сервис видео сейчас недоступен. Попробуйте позже.'
    if (err.status === 413) return 'Видео слишком большое.'
  }
  return 'Не удалось загрузить видео. Попробуйте ещё раз.'
}

// Ошибки действий в игре (приглашение, ход, ответ на приглашение)
export function describeGameError(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.code === 'network') return 'Нет связи с сервером. Попробуйте ещё раз.'
    if (err.code === 'game_exists') return 'С этим участником такая игра уже идёт или ждёт ответа.'
    if (err.code === 'not_your_turn') return 'Сейчас ход соперника.'
    if (err.code === 'illegal_move') return 'Так ходить нельзя.'
    if (err.code === 'cell_taken') return 'Эта клетка уже занята.'
    if (err.code === 'offer_too_soon') return 'Ничью можно предлагать один раз за ход.'
    if (err.code === 'already_offered') return 'Вы уже предложили ничью. Ждём ответа.'
    if (err.code === 'draw_offered' || err.code === 'no_offer') return 'Состояние игры уже изменилось. Обновите страницу.'
    if (err.code === 'not_active' || err.code === 'not_invited') return 'Состояние игры уже изменилось. Обновите экран.'
  }
  return 'Не удалось выполнить действие. Попробуйте ещё раз.'
}
