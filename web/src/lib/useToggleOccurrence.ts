import { useCallback, useState, type Dispatch, type SetStateAction } from 'react'
import { completeTask, uncompleteTask, type TaskList } from '@/api'
import { occurrenceKey, sameOccurrence, type TaskEntry } from './occurrences'

interface Options {
  // после снятия отметки убирать запись из списка (список «Выполненные»)
  removeWhenUndone?: boolean
}

// Отметка выполнения: список обновляется сразу, не дожидаясь сервера; если не получилось, возвращается как было.
export function useToggleOccurrence(
  token: string | undefined,
  memberId: string | undefined,
  list: TaskList | undefined,
  setList: Dispatch<SetStateAction<TaskList | undefined>>,
  { removeWhenUndone = false }: Options = {},
) {
  // ключ вхождения, по которому идёт запрос (чтобы заблокировать его флажок)
  const [busy, setBusy] = useState<string>()
  const [error, setError] = useState<string>()

  const toggle = useCallback(
    async ({ task, occurrence }: TaskEntry) => {
      if (!token || !memberId || !list) return
      const wasDone = occurrence.done !== null
      const previous = list
      setBusy(occurrenceKey(task.id, occurrence.date))
      setError(undefined)
      setList({
        ...list,
        occurrences: list.occurrences
          .filter((o) => !(removeWhenUndone && wasDone && sameOccurrence(o, task.id, occurrence.date)))
          .map((o) =>
            sameOccurrence(o, task.id, occurrence.date)
              ? { ...o, done: wasDone ? null : { memberId, at: new Date().toISOString() } }
              : o,
          ),
      })
      try {
        await (wasDone ? uncompleteTask : completeTask)(token, task.id, occurrence.date)
      } catch {
        setList(previous)
        setError('Не удалось изменить отметку. Попробуйте ещё раз.')
      } finally {
        setBusy(undefined)
      }
    },
    [token, memberId, list, setList, removeWhenUndone],
  )

  return { busy, error, toggle }
}
