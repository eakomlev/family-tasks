import { formatDayMonth } from '@/lib/date'
import type { TaskEntry } from '@/lib/occurrences'
import { Heading, Hidden, Late, List, Mark, Row, Section, Time, Title } from './styles'
import type { ChildTasksProps } from './types'

function TaskRow({ task, occurrence, overdue }: TaskEntry & { overdue?: boolean }) {
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
        {overdue && occurrence.date && <Late>{`просрочено, ${formatDayMonth(occurrence.date)}`}</Late>}
        {task.time && <Time>{task.time}</Time>}
      </Row>
    </li>
  )
}

// Задания ребёнка для родителя одним списком: просроченные, на сегодня (выполненные зачёркнуты и остаются), без срока и выполненные сегодня
// без срока или просроченные. Заданий нет: блока нет совсем, ничего про них не пишем.
export function ChildTasks({ tasks }: ChildTasksProps) {
  if (tasks === undefined) return null

  const overdue = tasks.overdue ?? []
  const all = [...overdue, ...tasks.today, ...tasks.undated, ...(tasks.finished ?? [])]
  if (all.length === 0) return null
  const done = all.filter((e) => e.occurrence.done !== null).length

  return (
    <Section>
      <Heading>
        <span>Задания на сегодня</span>
        <span>выполнено {done} из {all.length}</span>
      </Heading>
      <List>
        {all.map((entry) => <TaskRow key={`${entry.task.id}|${entry.occurrence.date ?? 'none'}`} {...entry} overdue={overdue.includes(entry)} />)}
      </List>
    </Section>
  )
}
