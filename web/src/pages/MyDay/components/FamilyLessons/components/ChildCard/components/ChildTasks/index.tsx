import { Heading, Hidden, List, Mark, Row, Section, Time, Title } from './styles'
import type { ChildTasksProps } from './types'

// задания ребёнка на сегодня: компактный список со ссылками на задания; выполненные зачёркнуты и остаются в списке
export function ChildTasks({ entries }: ChildTasksProps) {
  if (entries === undefined) return null

  const done = entries.filter((e) => e.occurrence.done !== null).length

  return (
    <Section>
      <Heading>
        <span>Задания на сегодня</span>
        {entries.length > 0 && <span>выполнено {done} из {entries.length}</span>}
      </Heading>
      {entries.length === 0 ? (
        <Heading>Заданий нет.</Heading>
      ) : (
        <List>
          {entries.map(({ task, occurrence }) => {
            const isDone = occurrence.done !== null
            return (
              <li key={`${task.id}|${occurrence.date}`}>
                <Row to={`/tasks/${task.id}?date=${occurrence.date}`} $done={isDone}>
                  <Mark $done={isDone} aria-hidden>{isDone && '✓'}</Mark>
                  <Title $done={isDone}>
                    <Hidden>{isDone ? 'Выполнено: ' : ''}</Hidden>
                    {task.title}
                  </Title>
                  {task.time && <Time>{task.time}</Time>}
                </Row>
              </li>
            )
          })}
        </List>
      )}
    </Section>
  )
}
