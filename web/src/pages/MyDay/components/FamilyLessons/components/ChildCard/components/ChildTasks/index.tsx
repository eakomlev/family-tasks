import type { TaskEntry } from '@/lib/occurrences'
import { Heading, Hidden, List, Mark, Row, Section, Time, Title } from './styles'
import type { ChildTasksProps } from './types'

function TaskRow({ task, occurrence }: TaskEntry) {
  const isDone = occurrence.done !== null
  return (
    <li>
      {/* у задания без срока в ссылке нет даты */}
      <Row to={`/tasks/${task.id}${occurrence.date ? `?date=${occurrence.date}` : ''}`} $done={isDone}>
        <Mark $done={isDone} aria-hidden>{isDone && '✓'}</Mark>
        <Title $done={isDone}>
          <Hidden>{isDone ? 'Выполнено: ' : ''}</Hidden>
          {task.title}
        </Title>
        {task.time && <Time>{task.time}</Time>}
      </Row>
    </li>
  )
}

// Задания ребёнка для родителя: на сегодня (выполненные зачёркнуты и остаются в списке) и отдельной группой без срока.
export function ChildTasks({ tasks }: ChildTasksProps) {
  if (tasks === undefined) return null

  const { today, undated } = tasks
  const done = today.filter((e) => e.occurrence.done !== null).length

  return (
    <Section>
      <Heading>
        <span>Задания на сегодня</span>
        {today.length > 0 && <span>выполнено {done} из {today.length}</span>}
      </Heading>
      {today.length === 0 && undated.length === 0 && <Heading>Заданий нет.</Heading>}
      {today.length === 0 && undated.length > 0 && <Heading>На сегодня заданий нет.</Heading>}
      {today.length > 0 && (
        <List>
          {today.map((entry) => <TaskRow key={`${entry.task.id}|${entry.occurrence.date}`} {...entry} />)}
        </List>
      )}
      {undated.length > 0 && (
        <>
          <Heading><span>Без срока</span></Heading>
          <List>
            {undated.map((entry) => <TaskRow key={`${entry.task.id}|none`} {...entry} />)}
          </List>
        </>
      )}
    </Section>
  )
}
