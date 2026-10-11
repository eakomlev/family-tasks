import { Avatar } from '@/components/Avatar'
import { formatDateTime } from '@/lib/date'
import { Body, Badge, Card, Chevron, Hidden, Meta, Row, Title, Who } from './styles'
import { TaskIcon } from './TaskIcon'
import type { TaskItemProps, TaskState } from './types'
import { authorLabel, taskMeta } from './utils'

const STATE_LABELS: Record<TaskState, string> = { todo: '', done: 'Выполнено:', late: 'Просрочено:' }

// карточка задания: вся целиком ссылка на страницу задания; значок показывает, выполнено ли оно
export function TaskItem({ task, occurrence, assignee, showAssignee, author, doneBy, showDate, today }: TaskItemProps) {
  const done = occurrence.done !== null
  const { parts, late } = taskMeta(task, occurrence, today, showDate)
  const state: TaskState = done ? 'done' : late ? 'late' : 'todo'

  // «от …» полезно, когда задание дал не сам исполнитель
  const from = authorLabel(author, assignee)

  return (
    <Row>
      <Card to={`/tasks/${task.id}${occurrence.date ? `?date=${occurrence.date}` : ''}`}>
        <Badge $state={state}>
          <TaskIcon state={state} />
        </Badge>
        <Body>
          <Title $done={done}>
            {state !== 'todo' && <Hidden>{STATE_LABELS[state]} </Hidden>}
            {task.title}
          </Title>
          {(parts.length > 0 || (showAssignee && assignee) || from || doneBy) && (
            <Meta $late={late}>
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
      </Card>
    </Row>
  )
}
