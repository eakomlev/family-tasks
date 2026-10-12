import { useEffect, useState, type ReactNode } from 'react'
import { listPendingTasks, listTasks, type TaskList } from '@/api'
import { useIdentity } from '@/identity/context'
import { todayIso } from '@/lib/date'
import { countActionable } from '@/lib/occurrences'
import { useNow } from '@/lib/useNow'
import { useLive } from '@/realtime/context'
import { TaskBadgeContext } from './context'

// Считает задания, которые ждут действия, для значка на панели табов. Обновляется по сигналам сокета и при смене дня.
export function TaskBadgeProvider({ children }: { children: ReactNode }) {
  const { identity } = useIdentity()
  const today = todayIso(useNow())
  const [lists, setLists] = useState<{ today: TaskList; pending: TaskList }>()
  const [version, setVersion] = useState(0)
  useLive(['tasks'], () => setVersion((v) => v + 1))

  const token = identity?.token
  useEffect(() => {
    if (!token) return
    let cancelled = false
    Promise.all([listTasks(token, today, today), listPendingTasks(token)])
      .then(([current, pending]) => !cancelled && setLists({ today: current, pending }))
      .catch(() => {}) // при сбое остаётся прежнее число
    return () => { cancelled = true }
  }, [token, today, version])

  const count = lists && identity ? countActionable(lists.today, lists.pending, identity.memberId, identity.role !== 'child', today) : 0
  return <TaskBadgeContext value={count}>{children}</TaskBadgeContext>
}
