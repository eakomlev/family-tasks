import { useEffect, useState } from 'react'
import { listDoneTasks, listTasks, type TaskList } from '@/api'
import { Chip } from '@/components/Chip'
import { Notice } from '@/components/Notice'
import { Page } from '@/components/Page'
import { Select } from '@/components/Select'
import { Stack } from '@/components/Stack'
import { TaskItem } from '@/components/TaskItem'
import { useIdentity } from '@/identity/context'
import { addDays, todayIso } from '@/lib/date'
import { occurrenceKey, type TaskEntry } from '@/lib/occurrences'
import { useNow } from '@/lib/useNow'
import { useProfile } from '@/profile/context'
import { useLive } from '@/realtime/context'
import { AddButton, Filters, Header, List, ListEnd, SectionTitle } from './styles'
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
  // растёт, когда по сокету пришло изменение: список запрашивается заново
  const [version, setVersion] = useState(0)
  useLive(['tasks'], () => setVersion((v) => v + 1))

  const token = identity?.token
  const me = identity?.memberId
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
  }, [token, tab, today, version])

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
      assignee={memberById.get(entry.task.assigneeId)}
      showAssignee={filter === null}
      author={memberById.get(entry.task.authorId)}
      showDate={tab === 'done'}
      doneBy={tab === 'done' && entry.occurrence.done ? memberById.get(entry.occurrence.done.memberId) : undefined}
      today={today}
    />
  )

  return (
    <Page>
      <Header>
        <h1>Задания</h1>
        <Select aria-label="Раздел" value={tab} onChange={(e) => switchTab(e.target.value as Tab)}>
          <option value="upcoming">Предстоящие</option>
          <option value="done">Выполненные</option>
        </Select>
      </Header>

      {/* ребёнок видит только свои задания (сервер другие не отдаёт), фильтр по людям ему не нужен */}
      {identity?.role !== 'child' && (
        <Filters aria-label="Чьи задания">
          <Chip type="button" aria-pressed={filter === null} $active={filter === null} onClick={() => setFilter(null)}>Все</Chip>
          {me && <Chip type="button" aria-pressed={filter === me} $active={filter === me} onClick={() => setFilter(me)}>Мои</Chip>}
          {members.filter((m) => m.id !== me).map((m) => (
            <Chip key={m.id} type="button" aria-pressed={filter === m.id} $active={filter === m.id} onClick={() => setFilter(m.id)}>{m.name}</Chip>
          ))}
        </Filters>
      )}

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

      <ListEnd />
      <AddButton to="/tasks/new">＋ Новая задача</AddButton>
    </Page>
  )
}
