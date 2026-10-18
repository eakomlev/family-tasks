import { ApiError, type Goal, type GoalInput } from '@/api'
import { ImageError } from '@/lib/imageError'

export const MAX_PRICE = 100000

export interface GoalFormState {
  title: string
  // цена строкой, как в поле ввода
  price: string
  url: string
  image: string | null
}

export const emptyGoalForm = (): GoalFormState => ({ title: '', price: '', url: '', image: null })

export const fromGoal = (goal: Goal): GoalFormState => ({
  title: goal.title,
  price: String(goal.price),
  url: goal.url ?? '',
  image: goal.image,
})

// Текст ошибки или null, если форма заполнена верно.
export function validateGoal(form: GoalFormState): string | null {
  if (!form.title.trim()) return 'Введите название цели.'
  const price = Number(form.price)
  if (form.price.trim() === '' || !Number.isInteger(price) || price < 1 || price > MAX_PRICE) return `Цена: целое число монет от 1 до ${MAX_PRICE}.`
  const url = form.url.trim()
  if (url && !/^https?:\/\/\S+$/i.test(url)) return 'Ссылка должна начинаться с http:// или https://.'
  return null
}

export const toGoalInput = (form: GoalFormState): GoalInput => ({
  title: form.title.trim(),
  price: Number(form.price),
  url: form.url.trim() || null,
  image: form.image,
})

export function describeGoalError(err: unknown): string {
  if (err instanceof ImageError) {
    if (err.reason === 'not_image') return 'Выберите файл с изображением.'
    if (err.reason === 'no_permission') return 'Нет доступа к фотографиям. Разрешите его в настройках телефона.'
    if (err.reason === 'too_large') return 'Файл слишком большой. Выберите картинку поменьше.'
    return 'Не удалось прочитать это изображение. Попробуйте другое.'
  }
  if (err instanceof ApiError) {
    if (err.code === 'network') return 'Нет связи с сервером. Попробуйте ещё раз.'
    if (err.code === 'already_purchased') return 'Цель уже куплена, изменить её нельзя.'
  }
  return 'Не удалось сохранить цель. Попробуйте ещё раз.'
}
