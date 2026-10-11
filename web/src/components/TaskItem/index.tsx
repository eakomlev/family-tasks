import { Avatar } from '@/components/Avatar'
import { formatDateTime } from '@/lib/date'
import { Actions, Body, Badge, Card, Chevron, Hidden, Inner, Meta, Row, Shell, Title, Who } from './styles'
import { TaskIcon } from './TaskIcon'
import type { TaskItemProps, TaskState } from './types'
import { authorLabel, taskMeta } from './utils'

const STATE_LABELS: Record<TaskState, string> = { todo: '', done: 'Выполнено:', late: 'Просрочено:', pending: 'На проверке:' }

// карточка задания: вся целиком ссылка на страницу задания; значок показывает, выполнено ли оно или ждёт проверки родителем
export function TaskItem({ task, occurrence, assignee, showAssignee, author, doneBy, showDate, today, review }: TaskItemProps) {
  const done = occurrence.done !== null
  const pending = occurrence.pending !== null
  const { parts, late } = taskMeta(task, occurrence, today, showDate)
  const state: TaskState = done ? 'done' : pending ? 'pending' : late ? 'late' : 'todo'

  // «от …» полезно, когда задание дал не сам исполнитель
  const from = authorLabel(author, assignee)
  const to = `/tasks/${task.id}${occurrence.date ? `?date=${occurrence.date}` : ''}`

  const content = (
    <>
      <Badge $state={state}>
        <TaskIcon state={state} />
      </Badge>
      <Body>
        <Title $done={done}>
          {state !== 'todo' && <Hidden>{STATE_LABELS[state]} </Hidden>}
          {task.title}
        </Title>
        {(parts.length > 0 || pending || (showAssignee && assignee) || from || doneBy) && (
          <Meta $late={late}>
            {pending && <span>{occurrence.pending && review ? 'Ждёт вашего подтверждения' : 'Ждёт подтверждения родителей'}</span>}
            {parts.map((part) => <span key={part}>{part}</span>)}
            {showAssignee && assignee && (
              <Who>
                <Avatar name={assignee.name} seed={assignee.id} src={assignee.avatar} size="1.1rem" />
                {assignee.name}
              </Who>
            )}
            {from && <span>{from}</span>}
            {doneBy && occurrence.done && <span>выполнил(а): {doneBy.name}, {formatDateTime(occurrence.done.at)}</span>}
          </Meta>
        )}
      </Body>
      <Chevron aria-hidden>›</Chevron>
    </>
  )

  // родителю у карточки «на проверке» под ссылкой кнопки «Подтвердить» и «Вернуть»
  if (review && pending) {
    return (
      <Row>
        <Shell>
          <Inner to={to}>{content}</Inner>
          <Actions>
            <button type="button" data-primary disabled={review.busy} onClick={review.onConfirm}>
              Подтвердить{task.reward > 0 ? `: +${task.reward}` : ''}
            </button>
            <button type="button" disabled={review.busy} onClick={review.onReject}>Вернуть</button>
          </Actions>
        </Shell>
      </Row>
    )
  }

  return (
    <Row>
      <Card to={to}>{content}</Card>
    </Row>
  )
}
