import { ApiError } from '@/api'

export function describeSaveError(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.code === 'name_taken') return 'В семье уже есть участник с таким именем. Выберите другое.'
    if (err.code === 'invalid_birth_date') return 'Укажите корректную дату рождения.'
  }
  return 'Не удалось сохранить. Попробуйте ещё раз.'
}
