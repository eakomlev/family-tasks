import { Avatar } from '@/components/Avatar'
import { Body, Check, Meta, Row, Title, Who } from './styles'
import type { TaskItemProps } from './types'
import { taskMeta } from './utils'

// строка задания: флажок выполнения, название-ссылка, срок, повтор и исполнитель
export function TaskItem({ task, occurrence, assignee, doneBy, today, disabled, onToggle }: TaskItemProps) {
  const done = occurrence.done !== null
  const { parts, late } = taskMeta(task, occurrence, today)

  return (
    <Row>
      <Check
        type="button"
        role="checkbox"
        aria-checked={done}
        aria-label={`${done ? 'Снять отметку' : 'Отметить выполненным'}: ${task.title}`}
        $done={done}
        disabled={disabled}
        onClick={onToggle}
      >
        {done && '✓'}
      </Check>
      <Body>
        <Title to={`/tasks/${task.id}`} $done={done}>{task.title}</Title>
        {(parts.length > 0 || assignee || doneBy) && (
          <Meta $late={late}>
            {parts.map((part) => <span key={part}>{part}</span>)}
            {assignee && (
              <Who>
                <Avatar name={assignee.name} seed={assignee.id} src={assignee.avatar} size="1.1rem" />
                {assignee.name}
              </Who>
            )}
            {doneBy && <span>выполнил(а): {doneBy.name}</span>}
          </Meta>
        )}
      </Body>
    </Row>
  )
}
