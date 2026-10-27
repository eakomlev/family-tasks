import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { isParent } from '@/lib/roles'
import { Chip } from '@/components/Chip'
import { MenuButton } from '@/components/PopupMenu'
import { PendingReview } from '@/components/PendingReview'
import { Notice } from '@/components/Notice'
import { Page } from '@/components/Page'
import { Stack } from '@/components/Stack'
import { TaskItem } from '@/components/TaskItem'
import { useIdentity } from '@/identity/context'
import { addDays, todayIso } from '@/lib/date'
import { occurrenceKey, type TaskEntry } from '@/lib/occurrences'
import { useTasksView } from '@/lib/tasksView'
import { useNow } from '@/lib/useNow'
import { useProfile } from '@/profile/context'
import { useListDoneTasksQuery, useListTasksQuery } from '@/store/tasks'
import { Actions, AddLink, Filters, Header, List, SectionTitle } from './styles'
import { buildDone, buildSections } from './utils'

// сколько дней вперёд показываем в предстоящих
const DAYS_AHEAD = 7

// у ребёнка вкладки «Задачи» нет: его задания на «Моём дне»
export default function Tasks() {
  const { identity } = useIdentity()
  return identity?.role === 'child' ? <Navigate to="/my-day" replace /> : <TasksList />
}

function TasksList() {
  const { identity } = useIdentity()
  const { data } = useProfile()
  const today = todayIso(useNow())

  const me = identity?.memberId
  // показ завершённых запоминается на устройстве (меню «три точки» в шапке)
  const [view, changeView] = useTasksView(me)
  const showDone = view.showDone
  // null — все; иначе id участника, чьи задания показываем
  const [filter, setFilter] = useState<string | null>(null)
  const members = data?.members ?? []
  const memberById = new Map(members.map((m) => [m.id, m]))

  // выполненные запрашиваются, только когда их показывают; оба запроса лежат в кэше и обновляются по сигналам сокета
  const upcoming = useListTasksQuery({ from: today, to: addDays(today, DAYS_AHEAD), collapse: true })
  const done = useListDoneTasksQuery({ days: 30 }, { skip: !showDone })
  const list = upcoming.data
  const loadFailed = upcoming.isError && !list

  // родителям ожидающие проверки показывает блок «Ждут подтверждения», поэтому в списках по дням они скрыты
  const isReviewer = isParent(identity?.role)
  const [pendingCount, setPendingCount] = useState(0)
  const sections = list ? buildSections(list, today, filter, { hidePending: isReviewer }) : []
  const doneEntries = done.data ? buildDone(done.data, filter) : []
  const upcomingEmpty = !!list && sections.length === 0 && pendingCount === 0

  const renderItem = (entry: TaskEntry) => (
    <TaskItem
      key={occurrenceKey(entry.task.id, entry.occurrence.date)}
      task={entry.task}
      occurrence={entry.occurrence}
      assignee={memberById.get(entry.task.assigneeId)}
      showAssignee={filter === null}
      author={memberById.get(entry.task.authorId)}
      showDate={entry.occurrence.done !== null}
      doneBy={entry.occurrence.done ? memberById.get(entry.occurrence.done.memberId) : undefined}
      today={today}
    />
  )

  return (
    <Page>
      <Header>
        <h1>Задания</h1>
        <Actions>
          <MenuButton actions={[{ key: 'done', label: 'Показать завершённые', checked: showDone, onSelect: () => changeView({ showDone: !showDone }) }]} />
          {/* выбран человек в фильтре: в новом задании он уже стоит исполнителем */}
          <AddLink to={filter ? `/tasks/new?assignee=${encodeURIComponent(filter)}` : '/tasks/new'} aria-label="Новая задача" title="Новая задача">
            <svg viewBox="0 0 24 24" aria-hidden>
              <path d="M12 5v14M5 12h14" />
            </svg>
          </AddLink>
        </Actions>
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
      {upcomingEmpty && <Notice $tone="muted">{filter === null ? 'Предстоящих заданий нет. Добавьте новое.' : 'У этого человека нет предстоящих заданий.'}</Notice>}

      <PendingReview assigneeId={filter} onCount={setPendingCount} />

      <Stack>
        {sections.map((section) => (
          <Stack as="section" key={section.key}>
            <SectionTitle>{section.title}</SectionTitle>
            <List>{section.items.map(renderItem)}</List>
          </Stack>
        ))}
        {showDone && (
          <Stack as="section">
            <SectionTitle>Выполненные</SectionTitle>
            {done.isError && !done.data && <Notice $tone="error">Не удалось загрузить выполненные задания. Проверьте соединение.</Notice>}
            {!done.data && !done.isError && <p>Загрузка…</p>}
            {done.data && doneEntries.length === 0 && <Notice $tone="muted">Выполненных заданий за последний месяц нет.</Notice>}
            {doneEntries.length > 0 && <List>{doneEntries.map(renderItem)}</List>}
          </Stack>
        )}
      </Stack>

    </Page>
  )
}
