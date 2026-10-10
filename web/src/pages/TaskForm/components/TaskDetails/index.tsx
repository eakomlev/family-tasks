import { Notice } from '@/components/Notice'
import { Stack } from '@/components/Stack'
import { describeDue, describeRepeat } from '@/lib/taskText'
import { Details } from '../../styles'
import type { TaskDetailsProps } from './types'

// чужое задание: смотреть можно, менять и удалять нельзя
export function TaskDetails({ task, author, assignee }: TaskDetailsProps) {
  const due = describeDue(task.date, task.time)
  const repeat = describeRepeat(task.repeat)

  return (
    <Stack>
      <Details>
        <dt>Исполнитель</dt>
        <dd>{assignee?.name ?? '—'}</dd>
        <dt>Автор</dt>
        <dd>{author?.name ?? '—'}</dd>
        <dt>Срок</dt>
        <dd>{due || 'без срока'}</dd>
        {repeat && (
          <>
            <dt>Повтор</dt>
            <dd>{repeat}{task.repeat.until ? ` до ${task.repeat.until.split('-').reverse().join('.')}` : ''}</dd>
          </>
        )}
      </Details>
      <Notice $tone="muted">Это задание создал другой человек: изменить или удалить его может только он. Отметить выполненным можно в списке заданий.</Notice>
    </Stack>
  )
}
