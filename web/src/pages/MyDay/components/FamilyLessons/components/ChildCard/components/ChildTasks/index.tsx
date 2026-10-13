import type { TaskEntry } from '@/lib/occurrences'
import { Heading, Hidden, List, Mark, Row, Section, Time, Title } from './styles'
import type { ChildTasksProps } from './types'

function TaskRow({ task, occurrence }: TaskEntry) {
  const isDone = occurrence.done !== null
  // отправлено ребёнком и ждёт подтверждения родителя: не выполнено, но и не «просто открыто»
  const isPending = occurrence.pending !== null
  return (
    <li>
      {/* у задания без срока в ссылке нет даты */}
      <Row to={`/tasks/${task.id}${occurrence.date ? `?date=${occurrence.date}` : ''}`} $done={isDone}>
        <Mark $done={isDone} $pending={isPending} aria-hidden>{isDone ? '✓' : isPending ? '…' : ''}</Mark>
        <Title $done={isDone}>
          <Hidden>{isDone ? 'Выполнено: ' : isPending ? 'На проверке: ' : ''}</Hidden>
          {task.title}
        </Title>
        {task.time && <Time>{task.time}</Time>}
      </Row>
    </li>
  )
}

// Задания ребёнка для родителя одним списком: на сегодня (выполненные зачёркнуты и остаются) и затем без срока.
// Заданий нет: блока нет совсем, ничего про них не пишем.
export function ChildTasks({ tasks }: ChildTasksProps) {
  if (tasks === undefined) return null

  const all = [...tasks.today, ...tasks.undated]
  if (all.length === 0) return null
  const done = all.filter((e) => e.occurrence.done !== null).length

  return (
    <Section>
      <Heading>
        <span>Задания на сегодня</span>
        <span>выполнено {done} из {all.length}</span>
      </Heading>
      <List>
        {all.map((entry) => <TaskRow key={`${entry.task.id}|${entry.occurrence.date ?? 'none'}`} {...entry} />)}
      </List>
    </Section>
  )
}
