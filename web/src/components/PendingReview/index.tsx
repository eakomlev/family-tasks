import { ZoneTitle } from '@/components/ZoneTitle'
import { useEffect } from 'react'
import { isParent } from '@/lib/roles'
import { Notice } from '@/components/Notice'
import { TaskItem } from '@/components/TaskItem'
import { useIdentity } from '@/identity/context'
import { todayIso } from '@/lib/date'
import { occurrenceKey, toEntries } from '@/lib/occurrences'
import { useReview } from '@/lib/useReview'
import { useProfile } from '@/profile/context'
import { useListPendingTasksQuery } from '@/store/tasks'
import { List, Section } from './styles'
import type { PendingReviewProps } from './types'

// Задания, которые дети отправили на проверку: родитель подтверждает (дети получают награду) или возвращает.
// Блок показывается только родителям и только когда есть что проверять.
export function PendingReview({ assigneeId = null, onCount }: PendingReviewProps) {
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

  const members = data?.members ?? []
  const byId = new Map(members.map((m) => [m.id, m]))
  const today = todayIso()

  return (
    <Section aria-label="Ждут подтверждения">
      <ZoneTitle tone="decide" icon="hourglass" count={entries.length} countLabel={`Заданий: ${entries.length}`}>
        Ждут подтверждения
      </ZoneTitle>
      {review.error && <Notice $tone="error">{review.error}</Notice>}
      <List>
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
      </List>
    </Section>
  )
}
