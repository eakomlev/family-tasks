import { useCallback, useRef, useState } from 'react'
import { useConfirmTaskMutation, useUncompleteTaskMutation } from '@/store/tasks'
import { occurrenceKey, type TaskEntry } from './occurrences'

// Действия родителя над заданиями, ожидающими проверки: подтвердить (выдать награду) или вернуть на доработку.
// Списки обновляются сами: мутации сбрасывают теги заданий, ожидающих проверки и монет. busy: ключ вхождения, по которому идёт запрос.
export function useReview() {
  const [busy, setBusy] = useState<string>()
  const [error, setError] = useState<string>()
  // пока идёт одно действие, остальные игнорируются (двойное нажатие до перерисовки)
  const flying = useRef(false)
  const [confirmTask] = useConfirmTaskMutation()
  const [uncompleteTask] = useUncompleteTaskMutation()

  const act = useCallback(
    async (entry: TaskEntry, action: typeof confirmTask) => {
      if (flying.current) return
      flying.current = true
      setBusy(occurrenceKey(entry.task.id, entry.occurrence.date))
      setError(undefined)
      try {
        await action({ id: entry.task.id, date: entry.occurrence.date }).unwrap()
      } catch {
        setError('Не удалось выполнить. Попробуйте ещё раз.')
      } finally {
        flying.current = false
        setBusy(undefined)
      }
    },
    [],
  )

  return {
    busy,
    error,
    confirm: (entry: TaskEntry) => act(entry, confirmTask),
    reject: (entry: TaskEntry) => act(entry, uncompleteTask),
  }
}
