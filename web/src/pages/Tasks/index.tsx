import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { listDoneTasks, listTasks, type TaskList } from '@/api'
import { Button } from '@/components/Button'
import { Chip } from '@/components/Chip'
import { Notice } from '@/components/Notice'
import { Page } from '@/components/Page'
import { Stack } from '@/components/Stack'
import { TaskItem } from '@/components/TaskItem'
import { useIdentity } from '@/identity/context'
import { addDays, todayIso } from '@/lib/date'
import { occurrenceKey, type TaskEntry } from '@/lib/occurrences'
import { useNow } from '@/lib/useNow'
import { useToggleOccurrence } from '@/lib/useToggleOccurrence'
import { useProfile } from '@/profile/context'
import { Filters, Header, List, SectionTitle } from './styles'
import type { Tab } from './types'
import { buildDone, buildSections } from './utils'

// сколько дней вперёд показываем в «Предстоящих»
const DAYS_AHEAD = 7

export default function Tasks() {
  const { identity } = useIdentity()
  const { data } = useProfile()
  const today = todayIso(useNow())

  const [tab, setTab] = useState<Tab>('upcoming')
  // null — все; иначе id участника, чьи задания показываем
  const [filter, setFilter] = useState<string | null>(null)
  const [list, setList] = useState<TaskList>()
  const [loadFailed, setLoadFailed] = useState(false)

  const token = identity?.token
  const me = identity?.memberId
  const { busy, error, toggle } = useToggleOccurrence(token, me, list, setList, { removeWhenUndone: tab === 'done' })
  const members = data?.members ?? []
  const memberById = new Map(members.map((m) => [m.id, m]))

  useEffect(() => {
    if (!token) return
    let cancelled = false
    const request = tab === 'upcoming' ? listTasks(token, today, addDays(today, DAYS_AHEAD)) : listDoneTasks(token, 30)
    request
      .then((res) => !cancelled && setList(res))
      .catch(() => !cancelled && setLoadFailed(true))
    return () => { cancelled = true }
  }, [token, tab, today])

  function switchTab(next: Tab) {
    if (next === tab) return
    setList(undefined)
    setLoadFailed(false)
    setTab(next)
  }

  const sections = list && tab === 'upcoming' ? buildSections(list, today, filter) : []
  const doneEntries = list && tab === 'done' ? buildDone(list, filter) : []
  const isEmpty = !!list && (tab === 'upcoming' ? sections.length === 0 : doneEntries.length === 0)

  const renderItem = (entry: TaskEntry) => (
    <TaskItem
      key={occurrenceKey(entry.task.id, entry.occurrence.date)}
      task={entry.task}
      occurrence={entry.occurrence}
      assignee={filter === null ? memberById.get(entry.task.assigneeId) : undefined}
      doneBy={tab === 'done' && entry.occurrence.done ? memberById.get(entry.occurrence.done.memberId) : undefined}
      today={today}
      disabled={busy === occurrenceKey(entry.task.id, entry.occurrence.date)}
      onToggle={() => toggle(entry)}
    />
  )

  return (
    <Page>
      <Header>
        <h1>Задания</h1>
        <Button as={Link} to="/tasks/new" $variant="primary" $inline>+ Новое</Button>
      </Header>

      <Filters role="tablist" aria-label="Раздел">
        <Chip type="button" role="tab" aria-selected={tab === 'upcoming'} $active={tab === 'upcoming'} onClick={() => switchTab('upcoming')}>Предстоящие</Chip>
        <Chip type="button" role="tab" aria-selected={tab === 'done'} $active={tab === 'done'} onClick={() => switchTab('done')}>Выполненные</Chip>
      </Filters>

      <Filters aria-label="Чьи задания">
        <Chip type="button" aria-pressed={filter === null} $active={filter === null} onClick={() => setFilter(null)}>Все</Chip>
        {me && <Chip type="button" aria-pressed={filter === me} $active={filter === me} onClick={() => setFilter(me)}>Мои</Chip>}
        {members.filter((m) => m.id !== me).map((m) => (
          <Chip key={m.id} type="button" aria-pressed={filter === m.id} $active={filter === m.id} onClick={() => setFilter(m.id)}>{m.name}</Chip>
        ))}
      </Filters>

      {error && <Notice $tone="error">{error}</Notice>}
      {loadFailed && <Notice $tone="error">Не удалось загрузить задания. Проверьте соединение.</Notice>}
      {!list && !loadFailed && <p>Загрузка…</p>}
      {isEmpty && (
        <Notice $tone="muted">
          {tab === 'done' ? 'Выполненных заданий за последний месяц нет.' : filter === null ? 'Заданий пока нет. Добавьте первое.' : 'У этого человека нет заданий.'}
        </Notice>
      )}

      <Stack>
        {sections.map((section) => (
          <Stack as="section" key={section.key}>
            <SectionTitle>{section.title}</SectionTitle>
            <List>{section.items.map(renderItem)}</List>
          </Stack>
        ))}
        {doneEntries.length > 0 && <List>{doneEntries.map(renderItem)}</List>}
      </Stack>
    </Page>
  )
}
