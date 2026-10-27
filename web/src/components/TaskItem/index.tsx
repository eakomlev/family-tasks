import { useContext, useRef, useState } from 'react'
import { Avatar } from '@/components/Avatar'
import { IdentityContext } from '@/identity/context'
import { coinsWord } from '@/lib/coins'
import { formatDateTime } from '@/lib/date'
import { useLongPress } from '@/lib/useLongPress'
import { Actions, Body, Badge, Card, Chevron, Lead, Mark, Reward, Hidden, Inner, Meta, Row, Shell, Title } from './styles'
import { TaskIcon } from './TaskIcon'
import { TaskMenu } from './TaskMenu'
import type { TaskItemProps, TaskState } from './types'
import { authorLabel, taskMeta } from './utils'

const STATE_LABELS: Record<TaskState, string> = { todo: '', done: 'Выполнено:', late: 'Просрочено:', pending: 'На проверке:' }

// карточка задания: вся целиком ссылка на страницу задания; значок показывает, выполнено ли оно или ждёт проверки родителем
export function TaskItem({ task, occurrence, assignee, showAssignee, author, doneBy, showDate, today, review }: TaskItemProps) {
  // без провайдера входа (карточка сама по себе) меню нет
  const identity = useContext(IdentityContext)?.identity
  const [menu, setMenu] = useState(false)
  // менять и удалять может только автор: долгое нажатие (правая кнопка мыши) открывает «Изменить» и «Удалить»
  const canManage = !!identity && task.authorId === identity.memberId
  // после долгого нажатия палец отпускается над карточкой и даёт «клик»: переход по ссылке от него не нужен
  const lastLong = useRef(0)
  const press = useLongPress(
    canManage
      ? () => {
          lastLong.current = Date.now()
          setMenu(true)
        }
      : undefined,
  )
  const holdProps = {
    ...press,
    onClick: (e: React.MouseEvent) => {
      if (Date.now() - lastLong.current < 700) e.preventDefault()
    },
  }
  const done = occurrence.done !== null
  const pending = occurrence.pending !== null
  const { parts, late } = taskMeta(task, occurrence, today, showDate)
  const state: TaskState = done ? 'done' : pending ? 'pending' : late ? 'late' : 'todo'

  // «от …» полезно, когда задание дал не сам исполнитель
  const from = authorLabel(author, assignee)
  // вторая строка: срок, время и повтор, потом через запятую имя исполнителя («10:00, Миша»)
  const line = [...parts, ...(showAssignee && assignee ? [assignee.name] : [])].join(', ')
  const to = `/tasks/${task.id}${occurrence.date ? `?date=${occurrence.date}` : ''}`

  const content = (
    <>
      {assignee ? (
        // фото исполнителя: сразу видно, чьё задание; состояние (выполнено, просрочено, на проверке) отмечено значком на углу фото
        <Lead>
          <Avatar name={assignee.name} seed={assignee.id} src={assignee.avatar} size="2.75rem" />
          {state !== 'todo' && (
            <Mark $state={state}>
              <TaskIcon state={state} />
            </Mark>
          )}
        </Lead>
      ) : (
        <Badge $state={state}>
          <TaskIcon state={state} />
        </Badge>
      )}
      <Body>
        <Title $done={done}>
          {state !== 'todo' && <Hidden>{STATE_LABELS[state]} </Hidden>}
          {task.title}
        </Title>
        {(line || pending || from || doneBy) && (
          <Meta $late={late}>
            {pending && <span>{occurrence.pending && review ? 'Ждёт вашего подтверждения' : 'Ждёт подтверждения родителей'}</span>}
            {line && <span>{line}</span>}
            {from && <span>{from}</span>}
            {doneBy && occurrence.done && <span>выполнил(а): {doneBy.name}, {formatDateTime(occurrence.done.at)}</span>}
          </Meta>
        )}
      </Body>
      {/* награда за выполнение: видно, что задание «стоит» монет */}
      {task.reward > 0 ? (
        <Reward $done={done}>
          +{task.reward}
          <Hidden>{coinsWord(task.reward).slice(String(task.reward).length)}</Hidden>
        </Reward>
      ) : (
        <Chevron aria-hidden>›</Chevron>
      )}
    </>
  )

  const sheet = menu && <TaskMenu task={task} onClose={() => setMenu(false)} />

  // родителю у карточки «на проверке» под ссылкой кнопки «Подтвердить» и «Вернуть»
  if (review && pending) {
    return (
      <Row>
        <Shell>
          <Inner to={to} {...holdProps}>{content}</Inner>
          <Actions>
            <button type="button" data-primary disabled={review.busy} onClick={review.onConfirm}>
              Подтвердить{task.reward > 0 ? `: +${task.reward}` : ''}
            </button>
            <button type="button" disabled={review.busy} onClick={review.onReject}>Вернуть</button>
          </Actions>
        </Shell>
        {sheet}
      </Row>
    )
  }

  return (
    <Row>
      <Card to={to} {...holdProps}>{content}</Card>
      {sheet}
    </Row>
  )
}
