import { useState } from 'react'
import { Pressable, RefreshControl, View } from 'react-native'
import { useDispatch } from 'react-redux'
import { useTheme } from 'styled-components/native'
import { Avatar } from '@/components/Avatar'
import { Chip } from '@/components/Chip'
import { Notice } from '@/components/Notice'
import { Screen } from '@/components/Screen'
import { Stack } from '@/components/Stack'
import { Heading, Text, PageTitle } from '@/components/Text'
import { PendingReview } from '@/features/tasks/PendingReview'
import { TaskItem } from '@/features/tasks/TaskItem'
import type { Tab } from '@/features/tasks/types'
import { loadTasksView, saveTasksView } from '@/features/tasks/viewState'
import { buildDone, buildSections } from '@/features/tasks/sections'
import { useIdentity } from '@/identity/context'
import { addDays, todayIso } from '@/lib/date'
import { occurrenceKey, type TaskEntry } from '@/lib/occurrences'
import { isParent, memberLabel } from '@/lib/roles'
import { useNow } from '@/lib/useNow'
import { useProfile } from '@/profile/context'
import { api } from '@/store/api'
import { useListDoneTasksQuery, useListTasksQuery } from '@/store/tasks'

// сколько дней вперёд показываем в «Предстоящих»
const DAYS_AHEAD = 7

// Фильтр по человеку: фото и имя (как выбор участников в форме события)
function MemberPill({ name, seed, src, active, onPress }: { name: string; seed: string; src?: string | null; active: boolean; onPress: () => void }) {
  const { colors } = useTheme()
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 40, paddingVertical: 6, paddingLeft: 8, paddingRight: 14, borderRadius: 999, borderWidth: 1.5, borderColor: active ? colors.accent : colors.border, backgroundColor: active ? colors.accent : colors.surface }}
    >
      <Avatar name={name} seed={seed} src={src} size={26} />
      <Text $weight="extraBold" $size={14} style={active ? { color: '#ffffff' } : undefined}>
        {name}
      </Text>
    </Pressable>
  )
}

export default function Tasks() {
  const { identity } = useIdentity()
  const { data } = useProfile()
  const dispatch = useDispatch()
  const today = todayIso(useNow())

  const me = identity?.memberId
  // вкладка и фильтр запоминаются на устройстве; null в фильтре — все, иначе id участника, чьи задания показываем
  const [view, setView] = useState(() => loadTasksView(me))
  const members = data?.members ?? []
  const tab = view.tab
  // участника, которого уже нет в семье, считаем неизвестным: показываем всех
  const filter = view.filter && (view.filter === me || members.some((m) => m.id === view.filter)) ? view.filter : null
  const change = (next: Partial<typeof view>) => {
    const value = { ...view, ...next }
    setView(value)
    saveTasksView(me, value)
  }
  const setTab = (next: Tab) => change({ tab: next })
  const setFilter = (next: string | null) => change({ filter: next })
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
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          <Chip active={filter === null} onPress={() => setFilter(null)}>
            Все
          </Chip>
          {me && <MemberPill name="Мои" seed={me} src={data?.me.avatar} active={filter === me} onPress={() => setFilter(me)} />}
          {members
            .filter((m) => m.id !== me)
            .map((m) => (
              <MemberPill key={m.id} name={memberLabel(m, identity?.role ?? 'child')} seed={m.id} src={m.avatar} active={filter === m.id} onPress={() => setFilter(m.id)} />
            ))}
        </View>
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
    </Screen>
  )
}
