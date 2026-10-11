import type { Task, TaskInput } from '@/api'
import type { FormState } from './types'

export const emptyForm = (assigneeId: string): FormState => ({
  title: '',
  description: '',
  assigneeId,
  date: '',
  time: '',
  repeatType: 'none',
  days: [],
  until: '',
})

export const fromTask = (task: Task): FormState => ({
  title: task.title,
  description: task.description,
  assigneeId: task.assigneeId,
  date: task.date ?? '',
  time: task.time ?? '',
  repeatType: task.repeat.type,
  days: task.repeat.days,
  until: task.repeat.until ?? '',
})

export const toInput = (form: FormState): TaskInput => ({
  title: form.title.trim(),
  description: form.description.trim(),
  assigneeId: form.assigneeId,
  date: form.date || null,
  time: form.date && form.time ? form.time : null,
  repeat: {
    type: form.repeatType,
    days: form.repeatType === 'weekly' ? form.days : [],
    until: form.repeatType !== 'none' && form.until ? form.until : null,
  },
})

// Первая ошибка заполнения или undefined; серверные проверки те же, здесь для быстрого ответа.
export function validate(form: FormState): string | undefined {
  if (!form.title.trim()) return 'Введите название задания.'
  if (form.repeatType === 'weekly' && form.days.length === 0) return 'Выберите хотя бы один день недели.'
  if (form.repeatType !== 'none' && form.until && form.until < form.date) {
    return 'Дата окончания повтора не может быть раньше даты задания.'
  }
  return undefined
}
