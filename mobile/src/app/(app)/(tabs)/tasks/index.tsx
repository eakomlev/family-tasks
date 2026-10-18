import { useState } from 'react'
import { RefreshControl, ScrollView, View } from 'react-native'
import { useRouter } from 'expo-router'
import { useDispatch } from 'react-redux'
import { Button } from '@/components/Button'
import { Chip } from '@/components/Chip'
import { Notice } from '@/components/Notice'
import { Screen } from '@/components/Screen'
import { Stack } from '@/components/Stack'
import { Heading, Text, PageTitle } from '@/components/Text'
import { PendingReview } from '@/features/tasks/PendingReview'
import { TaskItem } from '@/features/tasks/TaskItem'
import type { Tab } from '@/features/tasks/types'
import { buildDone, buildSections } from '@/features/tasks/sections'
import { useIdentity } from '@/identity/context'
import { addDays, todayIso } from '@/lib/date'
import { occurrenceKey, type TaskEntry } from '@/lib/occurrences'
import { isParent } from '@/lib/roles'
import { useNow } from '@/lib/useNow'
import { useProfile } from '@/profile/context'
import { api } from '@/store/api'
import { useListDoneTasksQuery, useListTasksQuery } from '@/store/tasks'

// сколько дней вперёд показываем в «Предстоящих»
const DAYS_AHEAD = 7

export default function Tasks() {
  const { identity } = useIdentity()
  const { data } = useProfile()
  const router = useRouter()
  const dispatch = useDispatch()
  const today = todayIso(useNow())

  const [tab, setTab] = useState<Tab>('upcoming')
  // null — все; иначе id участника, чьи задания показываем
  const [filter, setFilter] = useState<string | null>(null)
  const me = identity?.memberId
  const members = data?.members ?? []
  const memberById = new Map(members.map((m) => [m.id, m]))

  // у каждой вкладки свой запрос в кэше; вторая вкладка запрашивается, только когда открыта
  const upcoming = useListTasksQuery({ from: today, to: addDays(today, DAYS_AHEAD), collapse: true }, { skip: tab !== 'upcoming' })
  const done = useListDoneTasksQuery({ days: 30 }, { skip: tab !== 'done' })
  const active = tab === 'upcoming' ? upcoming : done
  const list = active.data
  const loadFailed = active.isError && !list

  // родителям ожидающие проверки показывает блок «Ждут подтверждения», поэтому в списках по дням они скрыты
  const isReviewer = isParent(identity?.role)
  const [pendingCount, setPendingCount] = useState(0)
  const sections = list && tab === 'upcoming' ? buildSections(list, today, filter, { hidePending: isReviewer }) : []
  const doneEntries = list && tab === 'done' ? buildDone(list, filter) : []
  const isEmpty = !!list && (tab === 'upcoming' ? sections.length === 0 && pendingCount === 0 : doneEntries.length === 0)

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
    <Screen
     
      refreshControl={<RefreshControl refreshing={false} onRefresh={() => void dispatch(api.util.invalidateTags(['Tasks', 'Pending', 'Done']))} />}
    >
      <PageTitle>Задания</PageTitle>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Chip active={tab === 'upcoming'} onPress={() => setTab('upcoming')}>
          Предстоящие
        </Chip>
        <Chip active={tab === 'done'} onPress={() => setTab('done')}>
          Выполненные
        </Chip>
      </View>

      {/* ребёнок видит только свои задания (сервер другие не отдаёт), фильтр по людям ему не нужен */}
      {identity?.role !== 'child' && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }} style={{ flexGrow: 0 }}>
          <Chip active={filter === null} onPress={() => setFilter(null)}>
            Все
          </Chip>
          {me && (
            <Chip active={filter === me} onPress={() => setFilter(me)}>
              Мои
            </Chip>
          )}
          {members
            .filter((m) => m.id !== me)
            .map((m) => (
              <Chip key={m.id} active={filter === m.id} onPress={() => setFilter(m.id)}>
                {m.name}
              </Chip>
            ))}
        </ScrollView>
      )}

      {loadFailed && <Notice tone="error">Не удалось загрузить задания. Проверьте соединение.</Notice>}
      {!list && !loadFailed && <Text $tone="muted">Загрузка…</Text>}
      {isEmpty && (
        <Notice>
          {tab === 'done'
            ? 'Выполненных заданий за последний месяц нет.'
            : filter === null
              ? 'Предстоящих заданий нет. Добавьте новое.'
              : 'У этого человека нет предстоящих заданий.'}
        </Notice>
      )}

      {tab === 'upcoming' && <PendingReview assigneeId={filter} onCount={setPendingCount} />}

      {sections.map((section) => (
        <Stack key={section.key} $gap={10}>
          <Heading>{section.title}</Heading>
          {section.items.map(renderItem)}
        </Stack>
      ))}
      {doneEntries.length > 0 && <Stack $gap={10}>{doneEntries.map(renderItem)}</Stack>}

      {/* выбран человек в фильтре: в новом задании он уже стоит исполнителем */}
      <Button variant="primary" onPress={() => router.push(filter ? { pathname: '/tasks/new', params: { assignee: filter } } : '/tasks/new')}>
        ＋ Новая задача
      </Button>
    </Screen>
  )
}
