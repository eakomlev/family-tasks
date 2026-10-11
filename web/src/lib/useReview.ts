import { useCallback, useState } from 'react'
import { confirmTask, uncompleteTask } from '@/api'
import { occurrenceKey, type TaskEntry } from './occurrences'

// Действия родителя над заданиями, ожидающими проверки: подтвердить (выдать награду) или вернуть на доработку.
// onDone вызывается после успешного действия (обновить списки). busy: ключ вхождения, по которому идёт запрос.
export function useReview(token: string | undefined, onDone: () => void) {
  const [busy, setBusy] = useState<string>()
  const [error, setError] = useState<string>()

  const act = useCallback(
    async (entry: TaskEntry, action: typeof confirmTask) => {
      if (!token) return
      setBusy(occurrenceKey(entry.task.id, entry.occurrence.date))
      setError(undefined)
      try {
        await action(token, entry.task.id, entry.occurrence.date)
        onDone()
      } catch {
        setError('Не удалось выполнить. Попробуйте ещё раз.')
      } finally {
        setBusy(undefined)
      }
    },
    [token, onDone],
  )

  return {
    busy,
    error,
    confirm: (entry: TaskEntry) => act(entry, confirmTask),
    reject: (entry: TaskEntry) => act(entry, uncompleteTask),
  }
}
