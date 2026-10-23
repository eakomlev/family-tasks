import { useEffect, useMemo, useRef } from 'react'
import { Animated, Pressable, RefreshControl, ScrollView, View } from 'react-native'
import PagerView from 'react-native-pager-view'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useDispatch } from 'react-redux'
import { useTheme } from 'styled-components/native'
import { PageHeader } from '@/components/PageHeader'
import { PillTabs, type PillTab } from '@/components/PillTabs'
import { Screen } from '@/components/Screen'
import { Heading, Text } from '@/components/Text'
import { useIdentity } from '@/identity/context'
import {
  birthdayItems,
  compareItems,
  eachDay,
  endOfWeek,
  eventItems,
  formatDayHeading,
  formatPeriod,
  groupByDay,
  holidayItems,
  rangeFor,
  shiftAnchor,
  startOfWeek,
  taskItems,
  trainingItems,
  visibleItems,
} from '@/lib/calendar'
import { CALENDAR_KINDS, useCalendarSettings, type CalendarView } from '@/lib/calendarSettings'
import { todayIso } from '@/lib/date'
import { isAdult } from '@/lib/roles'
import { useChildTrainings } from '@/lib/useChildTrainings'
import { useNow } from '@/lib/useNow'
import { useProfile } from '@/profile/context'
import { api } from '@/store/api'
import { useListEventsQuery } from '@/store/events'
import { useListTasksQuery } from '@/store/tasks'
import { AgendaList, DayTimeline, kindColor, MonthView } from './CalendarViews'

const VIEWS: (PillTab & { view: CalendarView })[] = [
  { key: 'day', view: 'day', label: 'День', icon: 'today-outline' },
  { key: 'week', view: 'week', label: 'Неделя', icon: 'calendar-outline' },
  { key: 'month', view: 'month', label: 'Месяц', icon: 'grid-outline' },
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
  // одни данные на все три страницы: период месяца (целые недели) вмещает и неделю, и день
  const range = rangeFor('month', anchor)

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
  const refresh = () => void dispatch(api.util.invalidateTags(['Events', 'Tasks', 'Trainings']))

  // страницы День / Неделя / Месяц листаются пальцем (как главные табы), нижняя панель следует за листанием
  const pager = useRef<PagerView>(null)
  const index = VIEWS.findIndex((v) => v.view === view)
  const page = useRef(index)
  const position = useRef(new Animated.Value(index)).current
  // вид сменился снаружи (адрес, «Сегодня»): страница переходит следом
  useEffect(() => {
    if (page.current === index) return
    page.current = index
    pager.current?.setPageWithoutAnimation(index)
  }, [index])

  if (!identity) return null

  const legend = (
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
  )

  // селектор периода: закреплён вверху страницы, не прокручивается
  const selector = (pageView: CalendarView) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <Pressable onPress={() => go(pageView, shiftAnchor(pageView, anchor, -1))} accessibilityRole="button" accessibilityLabel="Назад" hitSlop={8}>
        <Ionicons name="chevron-back" size={26} color={colors.text} />
      </Pressable>
      <Text $weight="black" $size={20} style={{ flex: 1, textAlign: 'center' }} accessibilityRole="header">
        {formatPeriod(pageView, anchor)}
      </Text>
      {anchor !== today && (
        <Pressable onPress={() => go(pageView, today)} accessibilityRole="button" hitSlop={8}>
          <Text $weight="extraBold" $size={14} $tone="accent">
            Сегодня
          </Text>
        </Pressable>
      )}
      <Pressable onPress={() => go(pageView, shiftAnchor(pageView, anchor, 1))} accessibilityRole="button" accessibilityLabel="Вперёд" hitSlop={8}>
        <Ionicons name="chevron-forward" size={26} color={colors.text} />
      </Pressable>
    </View>
  )

  const dayItems = byDay.get(anchor) ?? []

  return (
    <Screen
      scroll={false}
      header={
        <PageHeader
          fallback="/"
          right={
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
              <Pressable onPress={() => router.push({ pathname: '/calendar/events/new', params: { date: anchor, view } })} accessibilityRole="button" accessibilityLabel="Новое событие" hitSlop={8}>
                <Ionicons name="add" size={30} color={colors.accent} />
              </Pressable>
              <Pressable onPress={() => router.push('/calendar/settings')} accessibilityRole="button" accessibilityLabel="Настройки календаря" hitSlop={8}>
                <Ionicons name="options-outline" size={24} color={colors.text} />
              </Pressable>
            </View>
          }
        >
          Календарь
        </PageHeader>
      }
    >
      <PagerView
        ref={pager}
        style={{ flex: 1 }}
        initialPage={index}
        onPageScroll={(e) => position.setValue(e.nativeEvent.position + e.nativeEvent.offset)}
        onPageSelected={(e) => {
          const next = e.nativeEvent.position
          if (page.current === next) return
          page.current = next
          go(VIEWS[next].view, anchor)
        }}
      >
        <View key="day" style={{ flex: 1, gap: 12 }}>
          {selector('day')}
          {legend}
          {loading && <Text $tone="muted">Загрузка…</Text>}
          {!loading && dayItems.length === 0 && <Text $tone="muted">В этот день записей нет</Text>}
          <DayTimeline day={anchor} items={dayItems} now={now} isToday={anchor === today} />
        </View>

        <View key="week" style={{ flex: 1, gap: 12 }}>
          {selector('week')}
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ gap: 14, paddingBottom: 8 }} refreshControl={<RefreshControl refreshing={false} onRefresh={refresh} />}>
            {loading && <Text $tone="muted">Загрузка…</Text>}
            {eachDay(startOfWeek(anchor), endOfWeek(anchor)).map((day) => (
              <View key={day} style={{ gap: 6 }}>
                <Pressable onPress={() => go('day', day)} accessibilityRole="button">
                  <Heading style={day === today ? { color: colors.accent } : undefined}>{formatDayHeading(day)}</Heading>
                </Pressable>
                <AgendaList items={byDay.get(day) ?? []} emptyText="—" />
              </View>
            ))}
            {legend}
          </ScrollView>
        </View>

        <View key="month" style={{ flex: 1, gap: 12 }}>
          {selector('month')}
          {/* сетка месяца закреплена, под ней прокручиваются записи выбранного дня */}
          <MonthView anchor={anchor} today={today} byDay={byDay} onSelect={(day) => go('month', day)} />
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ gap: 10, paddingBottom: 8 }} refreshControl={<RefreshControl refreshing={false} onRefresh={refresh} />}>
            {loading && <Text $tone="muted">Загрузка…</Text>}
            <Heading>{formatDayHeading(anchor)}</Heading>
            <AgendaList items={dayItems} emptyText="В этот день записей нет" />
            {legend}
          </ScrollView>
        </View>
      </PagerView>

      <PillTabs tabs={VIEWS} index={index} position={position} onPress={(i) => pager.current?.setPage(i)} />
    </Screen>
  )
}
