import { useEffect, useMemo, useRef, useState } from 'react'
import { Pressable, ScrollView, View, type LayoutChangeEvent } from 'react-native'
import { useRouter, type Href } from 'expo-router'
import styled, { useTheme } from 'styled-components/native'
import { Text } from '@/components/Text'
import { isoWeekdayOf } from '@/lib/date'
import { eachDay, endOfMonth, endOfWeek, isAllDay, placeTimed, startOfMonth, startOfWeek, timeLabel, type CalendarItem } from '@/lib/calendar'
import type { CalendarKind } from '@/lib/calendarSettings'
import { holidayOn } from '@/lib/holidays'
import { WEEK_DAYS } from '@/lib/weekdays'
import { formatDayHeading } from '@/lib/calendar'
import type { Palette } from '@/theme/palettes'

const KIND_EMOJI: Record<CalendarKind, string> = { event: '📅', task: '✅', birthday: '🎂', training: '🏃', holiday: '🎉' }

// цвет вида записи из темы
export const kindColor = (colors: Palette, kind: CalendarKind): string =>
  ({ event: colors.calEvent, task: colors.calTask, birthday: colors.calBirthday, training: colors.calTraining, holiday: colors.calHoliday })[kind]

const Row = styled.View<{ $color: string }>`
  flex-direction: row;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 14px;
  border-left-width: 5px;
  border-left-color: ${({ $color }) => $color};
  background-color: ${({ theme }) => theme.colors.surface};
`

// Нажатие на запись: адрес приходит строкой из логики календаря (то же, что в веб-версии)
function useOpen() {
  const router = useRouter()
  return (href: string) => router.push(href as Href)
}

// Записи одного дня списком: цветная полоска слева показывает вид, нажатие открывает запись
export function AgendaList({ items, emptyText = 'Записей нет' }: { items: CalendarItem[]; emptyText?: string }) {
  const { colors } = useTheme()
  const open = useOpen()
  if (items.length === 0) return <Text $tone="muted">{emptyText}</Text>
  return (
    <View style={{ gap: 6 }}>
      {items.map((item) => (
        <Pressable key={item.key} disabled={!item.href} onPress={() => item.href && open(item.href)} accessibilityRole={item.href ? 'button' : undefined}>
          <Row $color={kindColor(colors, item.kind)}>
            <Text $size={20}>{KIND_EMOJI[item.kind]}</Text>
            <View style={{ flex: 1 }}>
              <Text $weight="extraBold" style={{ textDecorationLine: item.done ? 'line-through' : 'none' }}>
                {item.title}
              </Text>
              {item.subtitle ? (
                <Text $size={13} $tone="muted">
                  {item.subtitle}
                </Text>
              ) : null}
            </View>
            {/* праздникам и дням рождения «весь день» не пишем: это и так понятно */}
            {(item.start || item.end || item.kind === 'event' || item.kind === 'task') && (
              <Text $size={13} $tone="muted">
                {timeLabel(item)}
              </Text>
            )}
          </Row>
        </Pressable>
      ))}
    </View>
  )
}

const DOT_ORDER: CalendarKind[] = ['holiday', 'birthday', 'event', 'training', 'task']

// Месяц сеткой целых недель. В ячейке число и точки по видам записей; нажатие выбирает день.
export function MonthView({ anchor, today, byDay, onSelect }: { anchor: string; today: string; byDay: Map<string, CalendarItem[]>; onSelect: (day: string) => void }) {
  const { colors } = useTheme()
  const days = useMemo(() => eachDay(startOfWeek(startOfMonth(anchor)), endOfWeek(endOfMonth(anchor))), [anchor])
  const month = anchor.slice(0, 7)
  const weeks: string[][] = []
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7))

  return (
    <View style={{ gap: 4 }} accessibilityLabel="Месяц">
      <View style={{ flexDirection: 'row' }}>
        {WEEK_DAYS.map((day) => (
          <Text key={day.value} $size={12} $weight="bold" $tone={day.value >= 6 ? 'error' : 'muted'} style={{ flex: 1, textAlign: 'center' }}>
            {day.short}
          </Text>
        ))}
      </View>
      {weeks.map((week) => (
        <View key={week[0]} style={{ flexDirection: 'row', gap: 4 }}>
          {week.map((day) => {
            const items = byDay.get(day) ?? []
            const kinds = DOT_ORDER.filter((kind) => items.some((item) => item.kind === kind))
            const selected = day === anchor
            const dayOff = isoWeekdayOf(day) >= 6 || holidayOn(day) !== null
            return (
              <Pressable
                key={day}
                onPress={() => onSelect(day)}
                accessibilityRole="button"
                accessibilityLabel={`${formatDayHeading(day)}${items.length > 0 ? `, записей: ${items.length}` : ''}`}
                accessibilityState={{ selected }}
                style={{
                  flex: 1,
                  height: 52,
                  alignItems: 'center',
                  paddingTop: 6,
                  borderRadius: 14,
                  borderWidth: day === today ? 2 : 0,
                  borderColor: colors.accent,
                  backgroundColor: selected ? colors.accentSoft : 'transparent',
                  opacity: day.slice(0, 7) === month ? 1 : 0.4,
                }}
              >
                <Text $weight={day === today ? 'black' : 'bold'} $size={15} $tone={dayOff ? 'error' : 'default'}>
                  {String(Number(day.slice(8, 10)))}
                </Text>
                <View style={{ flexDirection: 'row', gap: 3, marginTop: 4 }}>
                  {kinds.map((kind) => (
                    <View key={kind} style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: kindColor(colors, kind) }} />
                  ))}
                </View>
              </Pressable>
            )
          })}
        </View>
      ))}
    </View>
  )
}

const HOUR_PX = 56
const HOURS = Array.from({ length: 24 }, (_, hour) => hour)
// если на день ничего нет и сейчас не он, полоса открывается с утра
const DEFAULT_TOP_HOUR = 8
const minutesOf = (date: Date) => date.getHours() * 60 + date.getMinutes()

// Вид «День» как в Teams (занимает всё свободное место): сверху записи на весь день, ниже сутки полосой с часами и блоками записей по времени и длительности.
// Пересекающиеся записи стоят рядом колонками. В сегодняшнем дне красная линия «сейчас».
export function DayTimeline({ day, items, now, isToday }: { day: string; items: CalendarItem[]; now: Date; isToday: boolean }) {
  const { colors } = useTheme()
  const open = useOpen()
  // тип ссылки на ScrollView в этой версии React Native неудобен: нужен только scrollTo
  const scroller = useRef<{ scrollTo: (options: { y: number; animated: boolean }) => void }>(null)
  const allDay = items.filter(isAllDay)
  const placed = useMemo(() => placeTimed(items), [items])
  const [laneWidth, setLaneWidth] = useLaneWidth()

  // Куда прокрутить при открытии дня: за час до сейчас, иначе за полчаса до первой записи, иначе на утро
  const firstStart = placed.length > 0 ? Math.min(...placed.map((p) => p.startMin)) : null
  const topMinutes = isToday ? Math.max(0, minutesOf(now) - 60) : firstStart !== null ? Math.max(0, firstStart - 30) : DEFAULT_TOP_HOUR * 60
  useEffect(() => {
    scroller.current?.scrollTo({ y: (topMinutes * HOUR_PX) / 60, animated: false })
    // только при смене дня: пока человек листает, полоса не должна прыгать
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [day])

  return (
    <View style={{ gap: 8, flex: 1 }}>
      {allDay.length > 0 && <AgendaList items={allDay} />}
      <ScrollView ref={scroller as never} style={{ flex: 1 }} nestedScrollEnabled accessibilityLabel="Сутки по часам">
        <View style={{ height: 24 * HOUR_PX, marginLeft: 48 }} onLayout={setLaneWidth}>
          {HOURS.map((hour) => (
            <View key={hour} style={{ position: 'absolute', top: hour * HOUR_PX, left: -48, right: 0, flexDirection: 'row', borderTopWidth: 1, borderTopColor: colors.border }}>
              <Text $size={11} $tone="muted" style={{ width: 44, marginTop: -8, backgroundColor: colors.bg }}>{`${String(hour).padStart(2, '0')}:00`}</Text>
            </View>
          ))}
          {placed.map(({ item, startMin, endMin, column, columns }) => {
            const width = laneWidth / columns - 3
            return (
              <Pressable
                key={item.key}
                disabled={!item.href}
                onPress={() => item.href && open(item.href)}
                accessibilityLabel={`${item.title}, ${timeLabel(item)}`}
                style={{
                  position: 'absolute',
                  top: (startMin * HOUR_PX) / 60,
                  height: Math.max(((endMin - startMin) * HOUR_PX) / 60 - 2, 18),
                  left: (column / columns) * laneWidth,
                  width,
                  padding: 6,
                  borderRadius: 10,
                  overflow: 'hidden',
                  backgroundColor: kindColor(colors, item.kind),
                }}
              >
                <Text $weight="extraBold" $size={13} numberOfLines={1} style={{ color: '#ffffff' }}>
                  {item.title}
                </Text>
                <Text $size={11} numberOfLines={1} style={{ color: '#ffffff', opacity: 0.85 }}>
                  {[timeLabel(item), item.subtitle].filter(Boolean).join(' · ')}
                </Text>
              </Pressable>
            )
          })}
          {isToday && <View style={{ position: 'absolute', left: -4, right: 0, top: (minutesOf(now) * HOUR_PX) / 60, height: 2, backgroundColor: '#e5484d' }} />}
        </View>
      </ScrollView>
    </View>
  )
}

// ширина дорожки записей: нужна, чтобы расставить блоки колонками в пикселях
function useLaneWidth(): [number, (e: LayoutChangeEvent) => void] {
  const [width, setWidth] = useState(240)
  return [width, (e) => setWidth(e.nativeEvent.layout.width)]
}
