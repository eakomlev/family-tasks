import { useMemo } from 'react'
import { Pressable, RefreshControl, View } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useDispatch } from 'react-redux'
import { useTheme } from 'styled-components/native'
import { Chip } from '@/components/Chip'
import { Screen } from '@/components/Screen'
import { Stack } from '@/components/Stack'
import { Heading, Text, Title } from '@/components/Text'
import { useIdentity } from '@/identity/context'
import {
  birthdayItems,
  compareItems,
  eachDay,
  eventItems,
  formatDayHeading,
  formatPeriod,
  groupByDay,
  holidayItems,
  rangeFor,
  shiftAnchor,
  taskItems,
  trainingItems,
  visibleItems,
} from '@/lib/calendar'
import { CALENDAR_KINDS, useCalendarSettings, type CalendarView } from '@/lib/calendarSettings'
import { todayIso } from '@/lib/date'
import { goBack } from '@/lib/navigation'
import { isAdult } from '@/lib/roles'
import { useChildTrainings } from '@/lib/useChildTrainings'
import { useNow } from '@/lib/useNow'
import { useProfile } from '@/profile/context'
import { api } from '@/store/api'
import { useListEventsQuery } from '@/store/events'
import { useListTasksQuery } from '@/store/tasks'
import { AgendaList, DayTimeline, kindColor, MonthView } from './CalendarViews'

const VIEWS: { view: CalendarView; label: string }[] = [
  { view: 'day', label: 'День' },
  { view: 'week', label: 'Неделя' },
  { view: 'month', label: 'Месяц' },
]

const isIsoDate = (value?: string | null): value is string => !!value && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value))

// Семейный календарь: день, неделя или месяц. Собирает события, задания, дни рождения, тренировки и государственные праздники;
// что показывать и чьё, настраивается и хранится на устройстве. Период и вид в адресе: после записи возвращаетесь туда же.
export function CalendarScreen() {
  const { identity } = useIdentity()
  const { data: profile } = useProfile()
  const { colors } = useTheme()
  const router = useRouter()
  const dispatch = useDispatch()
  const params = useLocalSearchParams<{ view?: string; date?: string }>()
  const now = useNow()
  const today = todayIso(now)
  const [settings] = useCalendarSettings(identity?.memberId ?? '')

  const anchor = isIsoDate(params.date) ? params.date : today
  const view: CalendarView = VIEWS.some((v) => v.view === params.view) ? (params.view as CalendarView) : settings.view
  const range = rangeFor(view, anchor)

  const members = profile?.members ?? []
  const viewerRole = identity?.role ?? 'child'

  // чьи тренировки можно смотреть: взрослому всех детей, ребёнку свои
  const childIds = isAdult(viewerRole) ? members.filter((m) => m.role === 'child').map((m) => m.id) : identity ? [identity.memberId] : []
  const events = useListEventsQuery(range, { skip: !identity || !settings.kinds.event })
  const tasks = useListTasksQuery(range, { skip: !identity || !settings.kinds.task })
  const trainings = useChildTrainings(settings.kinds.training ? childIds : [])

  const eventData = events.data?.events
  const taskData = tasks.data
  const byDay = useMemo(() => {
    const all = [
      ...eventItems(eventData ?? [], range.from, range.to),
      ...taskItems(taskData, range.from, range.to),
      ...birthdayItems(members, range.from, range.to, viewerRole),
      ...trainingItems(trainings, members, range.from, range.to, identity?.memberId ?? ''),
      ...holidayItems(range.from, range.to),
    ]
    return groupByDay(visibleItems(all, settings).sort(compareItems))
    // members и trainings меняются целиком при обновлении данных
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventData, taskData, members, trainings, range.from, range.to, settings, viewerRole, identity?.memberId])

  const go = (nextView: CalendarView, date: string) => router.setParams({ view: nextView, date })
  const loading = (!eventData && events.isFetching) || (!taskData && tasks.isFetching)

  if (!identity) return null

  return (
    <Screen
     
      refreshControl={<RefreshControl refreshing={false} onRefresh={() => void dispatch(api.util.invalidateTags(['Events', 'Tasks', 'Trainings']))} />}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Pressable onPress={() => goBack(router, '/')} accessibilityRole="button" accessibilityLabel="Назад" hitSlop={8}>
          <Ionicons name="arrow-back" size={26} color={colors.text} />
        </Pressable>
        <Pressable onPress={() => router.push({ pathname: '/calendar/events/new', params: { date: anchor, view } })} accessibilityRole="button" accessibilityLabel="Новое событие" hitSlop={8}>
          <Ionicons name="add" size={30} color={colors.accent} />
        </Pressable>
        <Pressable onPress={() => go(view, shiftAnchor(view, anchor, -1))} accessibilityRole="button" accessibilityLabel="Назад" hitSlop={8}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <Title style={{ flex: 1, textAlign: 'center', fontSize: 20 }}>{formatPeriod(view, anchor)}</Title>
        <Pressable onPress={() => go(view, shiftAnchor(view, anchor, 1))} accessibilityRole="button" accessibilityLabel="Вперёд" hitSlop={8}>
          <Ionicons name="chevron-forward" size={24} color={colors.text} />
        </Pressable>
        <Pressable onPress={() => router.push('/calendar/settings')} accessibilityRole="button" accessibilityLabel="Настройки календаря" hitSlop={8}>
          <Ionicons name="options-outline" size={24} color={colors.text} />
        </Pressable>
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {VIEWS.map((v) => (
          <Chip key={v.view} active={view === v.view} onPress={() => go(v.view, anchor)}>
            {v.label}
          </Chip>
        ))}
        {anchor !== today && (
          <Chip onPress={() => go(view, today)}>Сегодня</Chip>
        )}
      </View>

      {loading && <Text $tone="muted">Загрузка…</Text>}

      <Stack>
        {view === 'month' && (
          <>
            <MonthView anchor={anchor} today={today} byDay={byDay} onSelect={(day) => go('month', day)} />
            <Heading>{formatDayHeading(anchor)}</Heading>
            <AgendaList items={byDay.get(anchor) ?? []} emptyText="В этот день записей нет" />
          </>
        )}

        {view === 'week' &&
          eachDay(range.from, range.to).map((day) => (
            <View key={day} style={{ gap: 6 }}>
              <Pressable onPress={() => go('day', day)} accessibilityRole="button">
                <Heading style={{ color: day === today ? colors.accent : undefined }}>{formatDayHeading(day)}</Heading>
              </Pressable>
              <AgendaList items={byDay.get(day) ?? []} emptyText="—" />
            </View>
          ))}

        {view === 'day' && (
          <>
            {(byDay.get(anchor) ?? []).length === 0 && <Text $tone="muted">В этот день записей нет</Text>}
            <DayTimeline day={anchor} items={byDay.get(anchor) ?? []} now={now} isToday={anchor === today} />
          </>
        )}
      </Stack>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }} accessibilityLabel="Обозначения">
        {CALENDAR_KINDS.filter(({ kind }) => settings.kinds[kind]).map(({ kind, label }) => (
          <View key={kind} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: kindColor(colors, kind) }} />
            <Text $size={13} $tone="muted">
              {label}
            </Text>
          </View>
        ))}
      </View>
    </Screen>
  )
}
