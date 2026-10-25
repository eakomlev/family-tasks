import { useEffect } from 'react'
import { ZoneTitle } from '@/components/ZoneTitle'
import { Notice } from '@/components/Notice'
import { Stack } from '@/components/Stack'

import { useIdentity } from '@/identity/context'
import { todayIso } from '@/lib/date'
import { occurrenceKey, toEntries } from '@/lib/occurrences'
import { isParent } from '@/lib/roles'
import { useReview } from '@/lib/useReview'
import { useProfile } from '@/profile/context'
import { useListPendingTasksQuery } from '@/store/tasks'
import { TaskItem } from './TaskItem'

// Задания, которые дети отправили на проверку: родитель подтверждает (ребёнок получает награду) или возвращает.
// Показывается только родителям и только когда есть что проверять.
export function PendingReview({ assigneeId = null, onCount }: { assigneeId?: string | null; onCount?: (count: number) => void }) {
  const { identity } = useIdentity()
  const { data } = useProfile()
  const isReviewer = isParent(identity?.role)
  const review = useReview()
  // тот же запрос, что у значка на табе «Задачи»: в кэше он общий
  const { data: list } = useListPendingTasksQuery(undefined, { skip: !isReviewer })

  const entries = isReviewer && list ? toEntries(list, assigneeId) : []
  const count = entries.length
  useEffect(() => {
    onCount?.(count)
  }, [count, onCount])

  if (count === 0) return null

  const byId = new Map((data?.members ?? []).map((m) => [m.id, m]))
  const today = todayIso()

  return (
    <Stack $gap={10} accessibilityLabel="Ждут подтверждения">
      <ZoneTitle tone="decide" icon="hourglass" count={count}>
        Ждут подтверждения
      </ZoneTitle>
      {review.error && <Notice tone="error">{review.error}</Notice>}
      {entries.map((entry) => {
        const key = occurrenceKey(entry.task.id, entry.occurrence.date)
        return (
          <TaskItem
            key={key}
            task={entry.task}
            occurrence={entry.occurrence}
            assignee={byId.get(entry.task.assigneeId)}
            showAssignee
            author={byId.get(entry.task.authorId)}
            showDate
            today={today}
            review={{ busy: review.busy === key, onConfirm: () => void review.confirm(entry), onReject: () => void review.reject(entry) }}
          />
        )
      })}
    </Stack>
  )
}
