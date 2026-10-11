import { useCallback, useEffect, useState } from 'react'
import { listPendingTasks, type TaskList } from '@/api'
import { Notice } from '@/components/Notice'
import { TaskItem } from '@/components/TaskItem'
import { useIdentity } from '@/identity/context'
import { todayIso } from '@/lib/date'
import { occurrenceKey, toEntries } from '@/lib/occurrences'
import { useReview } from '@/lib/useReview'
import { useProfile } from '@/profile/context'
import { useLive } from '@/realtime/context'
import { Count, List, Section, Title } from './styles'
import type { PendingReviewProps } from './types'

// Задания, которые дети отправили на проверку: родитель подтверждает (дети получают награду) или возвращает.
// Блок показывается только родителям и только когда есть что проверять.
export function PendingReview({ assigneeId = null, onCount }: PendingReviewProps) {
  const { identity } = useIdentity()
  const { data } = useProfile()
  const [list, setList] = useState<TaskList>()
  const [version, setVersion] = useState(0)
  useLive(['tasks'], () => setVersion((v) => v + 1))

  const token = identity?.token
  const isParent = !!identity && identity.role !== 'child'
  const reload = useCallback(() => setVersion((v) => v + 1), [])
  const review = useReview(token, reload)

  useEffect(() => {
    if (!token || !isParent) return
    let cancelled = false
    listPendingTasks(token)
      .then((res) => !cancelled && setList(res))
      .catch(() => {})
    return () => { cancelled = true }
  }, [token, isParent, version])

  const entries = isParent && list ? toEntries(list, assigneeId) : []
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
      <Title>
        Ждут подтверждения <Count aria-label={`Заданий: ${entries.length}`}>{entries.length}</Count>
      </Title>
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
