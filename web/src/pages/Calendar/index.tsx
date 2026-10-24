import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Chip } from '@/components/Chip'
import { Page } from '@/components/Page'
import { Stack } from '@/components/Stack'
import { useIdentity } from '@/identity/context'
import {
  birthdayItems,
  compareItems,
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
  eachDay,
} from '@/lib/calendar'
import { CALENDAR_KINDS, useCalendarSettings, type CalendarView } from '@/lib/calendarSettings'
import { todayIso } from '@/lib/date'
import { useChildTrainings } from '@/lib/useChildTrainings'
import { useNow } from '@/lib/useNow'
import { isAdult } from '@/lib/roles'
import { useProfile } from '@/profile/context'
import { useListEventsQuery } from '@/store/events'
import { useListTasksQuery } from '@/store/tasks'
import { AgendaList } from './components/AgendaList'
import { DayTimeline } from './components/DayTimeline'
import { MonthView } from './components/MonthView'
import { Arrow, DayHeading, DaySection, Dot, Empty, IconLink, Legend, Period, SettingsLink, Switch, Today, TopBar } from './styles'

const VIEWS: { view: CalendarView; label: string }[] = [
  { view: 'day', label: 'День' },
  { view: 'week', label: 'Неделя' },
  { view: 'month', label: 'Месяц' },
]

const isIsoDate = (value: string | null): value is string => !!value && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value))

// Семейный календарь: день, неделя или месяц. Собирает события, задания, дни рождения, тренировки и государственные праздники;
// что показывать и чьё, настраивается и хранится на устройстве. Период и вид в адресе: после записи возвращаетесь туда же.
export default function Calendar() {
  const { identity } = useIdentity()
  const { data: profile } = useProfile()
  const [params, setParams] = useSearchParams()
  const now = useNow()
  const today = todayIso(now)
  const [settings] = useCalendarSettings(identity?.memberId ?? '')

  const queryDate = params.get('date')
  const anchor = isIsoDate(queryDate) ? queryDate : today
  const queryView = params.get('view')
  const view: CalendarView = VIEWS.some((v) => v.view === queryView) ? (queryView as CalendarView) : settings.view
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
      ...taskItems(taskData, range.from, range.to, members, viewerRole),
      ...birthdayItems(members, range.from, range.to, viewerRole),
      ...trainingItems(trainings, members, range.from, range.to, identity?.memberId ?? ''),
      ...holidayItems(range.from, range.to),
    ]
    return groupByDay(visibleItems(all, settings).sort(compareItems))
    // members и trainings меняются целиком при обновлении данных
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventData, taskData, members, trainings, range.from, range.to, settings, viewerRole, identity?.memberId])

  const go = (nextView: CalendarView, date: string) => setParams({ view: nextView, date }, { replace: true })
  const loading = (!eventData && events.isFetching) || (!taskData && tasks.isFetching)

  if (!identity) return null

  return (
    <Page>
      <TopBar>
        <IconLink to={`/calendar/events/new?date=${anchor}`} aria-label="Новое событие">
          <svg viewBox="0 0 24 24" aria-hidden>
            <path d="M12 5v14M5 12h14" />
          </svg>
        </IconLink>
        <Period>
          <Arrow type="button" aria-label="Назад" onClick={() => go(view, shiftAnchor(view, anchor, -1))}>
            <svg viewBox="0 0 24 24" aria-hidden>
              <path d="M15 5l-7 7 7 7" />
            </svg>
          </Arrow>
          <h1 aria-live="polite">{formatPeriod(view, anchor)}</h1>
          <Arrow type="button" aria-label="Вперёд" onClick={() => go(view, shiftAnchor(view, anchor, 1))}>
            <svg viewBox="0 0 24 24" aria-hidden>
              <path d="M9 5l7 7-7 7" />
            </svg>
          </Arrow>
        </Period>
        <SettingsLink to="/calendar/settings" aria-label="Настройки календаря">
          <svg viewBox="0 0 24 24" aria-hidden>
            <path d="M4 7h10M18 7h2M4 17h2M10 17h10" />
            <circle cx="16" cy="7" r="2" />
            <circle cx="8" cy="17" r="2" />
          </svg>
        </SettingsLink>
      </TopBar>

      <Switch role="group" aria-label="Вид календаря">
        {VIEWS.map((v) => (
          <Chip key={v.view} type="button" aria-pressed={view === v.view} $active={view === v.view} onClick={() => go(v.view, anchor)}>
            {v.label}
          </Chip>
        ))}
        {anchor !== today && (
          <Today type="button" onClick={() => go(view, today)}>
            Сегодня
          </Today>
        )}
      </Switch>

      {loading && <Empty role="status">Загрузка…</Empty>}

      <Stack>
        {view === 'month' && (
          <>
            <MonthView anchor={anchor} today={today} byDay={byDay} onSelect={(day) => go('month', day)} />
            <DaySection aria-label={formatDayHeading(anchor)}>
              <h2>{formatDayHeading(anchor)}</h2>
              <AgendaList items={byDay.get(anchor) ?? []} emptyText="В этот день записей нет" />
            </DaySection>
          </>
        )}

        {view === 'week' &&
          eachDay(range.from, range.to).map((day) => (
            <DaySection key={day} $today={day === today} aria-label={formatDayHeading(day)}>
              <DayHeading type="button" onClick={() => go('day', day)}>
                {formatDayHeading(day)}
              </DayHeading>
              <AgendaList items={byDay.get(day) ?? []} emptyText="—" />
            </DaySection>
          ))}

        {view === 'day' && (
          <>
            {(byDay.get(anchor) ?? []).length === 0 && <Empty>В этот день записей нет</Empty>}
            <DayTimeline day={anchor} items={byDay.get(anchor) ?? []} now={now} isToday={anchor === today} />
          </>
        )}
      </Stack>

      <Legend aria-label="Обозначения">
        {CALENDAR_KINDS.filter(({ kind }) => settings.kinds[kind]).map(({ kind, label }) => (
          <span key={kind}>
            <Dot $kind={kind} />
            {label}
          </span>
        ))}
      </Legend>
    </Page>
  )
}
