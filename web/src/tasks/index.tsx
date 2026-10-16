import type { ReactNode } from 'react'
import { isParent } from '@/lib/roles'
import { useIdentity } from '@/identity/context'
import { todayIso } from '@/lib/date'
import { countActionable } from '@/lib/occurrences'
import { useNow } from '@/lib/useNow'
import { useListPendingTasksQuery, useListTasksQuery } from '@/store/tasks'
import { TaskBadgeContext } from './context'

// Считает задания, которые ждут действия, для значка на панели табов. Берёт уже загруженные списки из кэша
// (те же запросы, что на «Моём дне», объединяются): лишних запросов нет, обновляется по сигналам сокета через инвалидацию кэша.
export function TaskBadgeProvider({ children }: { children: ReactNode }) {
  const { identity } = useIdentity()
  const today = todayIso(useNow())
  const { data: current } = useListTasksQuery({ from: today, to: today })
  const { data: pending } = useListPendingTasksQuery()

  const count = current && pending && identity ? countActionable(current, pending, identity.memberId, isParent(identity.role), today) : 0
  return <TaskBadgeContext value={count}>{children}</TaskBadgeContext>
}
