import type { Task, TaskInput } from '@/api'
import { MAX_REWARD, REWARD_CHOICES } from '@/lib/coins'
import type { FormState } from './types'

export const emptyForm = (assigneeId: string): FormState => ({
  title: '',
  description: '',
  reward: '0',
  rewardCustom: false,
  scheduled: false,
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
  reward: String(task.reward),
  // награда вне готовых плашек показывается как «Другая»
  rewardCustom: task.reward > 0 && !REWARD_CHOICES.includes(task.reward),
  scheduled: task.date !== null,
  assigneeId: task.assigneeId,
  date: task.date ?? '',
  time: task.time ?? '',
  repeatType: task.repeat.type,
  days: task.repeat.days,
  until: task.repeat.until ?? '',
})

// Без галочки «Указать время» (или без даты) задание без срока: ни времени, ни повтора.
export const toInput = (form: FormState): TaskInput => {
  const dated = form.scheduled && form.date !== ''
  const repeatType = dated ? form.repeatType : 'none'
  return {
    title: form.title.trim(),
    description: form.description.trim(),
    reward: Number(form.reward) || 0,
    assigneeId: form.assigneeId,
    date: dated ? form.date : null,
    time: dated && form.time ? form.time : null,
    repeat: {
      type: repeatType,
      days: repeatType === 'weekly' ? form.days : [],
      until: repeatType !== 'none' && form.until ? form.until : null,
    },
  }
}

// Первая ошибка заполнения или undefined; серверные проверки те же, здесь для быстрого ответа.
export function validate(form: FormState): string | undefined {
  if (!form.title.trim()) return 'Введите название задания.'
  if (form.scheduled && !form.date) return 'Укажите дату или уберите галочку «Указать время».'
  if (form.rewardCustom) {
    const reward = Number(form.reward)
    if (form.reward.trim() === '' || !Number.isInteger(reward) || reward < 1 || reward > MAX_REWARD) {
      return `Награда: целое число от 1 до ${MAX_REWARD} монет.`
    }
  }
  if (form.repeatType === 'weekly' && form.days.length === 0) return 'Выберите хотя бы один день недели.'
  if (form.repeatType !== 'none' && form.until && form.until < form.date) {
    return 'Дата окончания повтора не может быть раньше даты задания.'
  }
  return undefined
}
