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
import { useTasksView } from '@/features/tasks/viewState'
import { buildDone, buildSections } from '@/features/tasks/sections'
import { useIdentity } from '@/identity/context'
import { addDays, todayIso } from '@/lib/date'
import { occurrenceKey, type TaskEntry } from '@/lib/occurrences'
import { isParent, memberLabel } from '@/lib/roles'
import { useNow } from '@/lib/useNow'
import { useProfile } from '@/profile/context'
import { api } from '@/store/api'
import { useListDoneTasksQuery, useListTasksQuery } from '@/store/tasks'

// сколько дней вперёд показываем в предстоящих
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
  // фильтр и показ завершённых запоминаются на устройстве; null в фильтре — все, иначе id участника, чьи задания показываем.
  // Переключатель завершённых стоит в меню «три точки» в углу оболочки, состояние общее
  const [view, change] = useTasksView(me)
  const members = data?.members ?? []
  const showDone = view.showDone
  // участника, которого уже нет в семье, считаем неизвестным: показываем всех
  const filter = view.filter && (view.filter === me || members.some((m) => m.id === view.filter)) ? view.filter : null
  const setFilter = (next: string | null) => change({ filter: next })
  const memberById = new Map(members.map((m) => [m.id, m]))

  // выполненные запрашиваются, только когда их показывают
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
    <Screen
     
      refreshControl={<RefreshControl refreshing={false} onRefresh={() => void dispatch(api.util.invalidateTags(['Tasks', 'Pending', 'Done']))} />}
    >
      <PageTitle>Задания</PageTitle>
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
      {upcomingEmpty && <Notice>{filter === null ? 'Предстоящих заданий нет. Добавьте новое.' : 'У этого человека нет предстоящих заданий.'}</Notice>}

      <PendingReview assigneeId={filter} onCount={setPendingCount} />

      {sections.map((section) => (
        <Stack key={section.key} $gap={10}>
          <Heading>{section.title}</Heading>
          {section.items.map(renderItem)}
        </Stack>
      ))}
      {showDone && (
        <Stack $gap={10}>
          <Heading>Выполненные</Heading>
          {done.isError && !done.data && <Notice tone="error">Не удалось загрузить выполненные задания. Проверьте соединение.</Notice>}
          {!done.data && !done.isError && <Text $tone="muted">Загрузка…</Text>}
          {done.data && doneEntries.length === 0 && <Notice>Выполненных заданий за последний месяц нет.</Notice>}
          {doneEntries.map(renderItem)}
        </Stack>
      )}
    </Screen>
  )
}
