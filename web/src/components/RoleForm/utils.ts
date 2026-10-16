import { ApiError } from '@/api'

// какой шаг и какой текст показать, если сервер отклонил регистрацию
export function describeSignupError(err: unknown): { text: string; backToDetails: boolean } {
  const code = err instanceof ApiError ? err.code : ''
  switch (code) {
    case 'name_taken':
      return { text: 'В семье уже есть участник с таким именем. Выберите другое.', backToDetails: true }
    case 'email_taken':
      return { text: 'Этот email уже используется в семье. Укажите другой.', backToDetails: true }
    case 'invalid_code':
      return { text: 'Неверный код или срок его действия истёк.', backToDetails: false }
    case 'family_full':
      return { text: 'В семье уже 6 участников — это максимум. Попросите владельца освободить место.', backToDetails: false }
    case 'invite_expired':
      return { text: 'Срок приглашения истёк. Попросите прислать новое.', backToDetails: false }
    default:
      return { text: 'Не удалось завершить. Попробуйте ещё раз.', backToDetails: false }
  }
}
