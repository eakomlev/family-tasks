import type { Member, TaskInput } from '@/api'
import type { FormState } from '../../types'

export interface TaskEditorProps {
  initial: FormState
  members: Member[]
  // id вошедшего участника: ему в списке исполнителей пишем «(я)»
  me: string
  submitLabel: string
  // должен бросить ошибку, если сохранить не удалось
  onSubmit: (input: TaskInput) => Promise<void>
  // есть только у существующего задания
  onDelete?: () => Promise<void>
}
