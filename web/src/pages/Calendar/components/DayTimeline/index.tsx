import { useLayoutEffect, useMemo, useRef } from 'react'
import { isAllDay, placeTimed, timeLabel, type CalendarItem } from '@/lib/calendar'
import { AgendaList } from '../AgendaList'
import { AllDay, Block, Hour, HOUR_REM, Lane, NowLine, PlainBlock, Scroller, Strip } from './styles'

const REM_PER_MINUTE = HOUR_REM / 60
const HOURS = Array.from({ length: 24 }, (_, hour) => hour)
// если на день ничего нет и сейчас не он, полоса открывается с утра
const DEFAULT_TOP_HOUR = 8

// rem с округлением: без хвоста вида 64.80000000000001
const rem = (value: number) => `${Math.round(value * 1000) / 1000}rem`

const minutesOf = (date: Date) => date.getHours() * 60 + date.getMinutes()

// Вид «День» как в Teams: сверху записи на весь день, ниже сутки полосой с часами и блоками записей по времени и длительности.
// Пересекающиеся записи стоят рядом колонками. В сегодняшнем дне красная линия «сейчас», полоса открывается на нужном месте.
export function DayTimeline({ day, items, now, isToday }: { day: string; items: CalendarItem[]; now: Date; isToday: boolean }) {
  const scroller = useRef<HTMLDivElement>(null)
  const allDay = items.filter(isAllDay)
  const placed = useMemo(() => placeTimed(items), [items])

  // Куда прокрутить при открытии дня: за час до сейчас, иначе за полчаса до первой записи, иначе на утро
  const firstStart = placed.length > 0 ? Math.min(...placed.map((p) => p.startMin)) : null
  const topMinutes = isToday ? Math.max(0, minutesOf(now) - 60) : firstStart !== null ? Math.max(0, firstStart - 30) : DEFAULT_TOP_HOUR * 60
  useLayoutEffect(() => {
    scroller.current?.scrollTo({ top: topMinutes * REM_PER_MINUTE * parseFloat(getComputedStyle(document.documentElement).fontSize || '16'), behavior: 'auto' })
    // только при смене дня: пока человек листает, полоса не должна прыгать
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [day])

  return (
    <>
      {allDay.length > 0 && (
        <AllDay>
          <AgendaList items={allDay} />
        </AllDay>
      )}
      <Scroller ref={scroller} role="group" aria-label="Сутки по часам">
        <Strip>
          {HOURS.map((hour) => (
            <Hour key={hour} style={{ top: rem(hour * HOUR_REM) }}>
              <span>{String(hour).padStart(2, '0')}:00</span>
            </Hour>
          ))}
          <Lane>
            {placed.map(({ item, startMin, endMin, column, columns }) => {
              const props = {
                $kind: item.kind,
                style: {
                  top: rem(startMin * REM_PER_MINUTE),
                  height: rem((endMin - startMin) * REM_PER_MINUTE - 0.1),
                  left: `${(column / columns) * 100}%`,
                  width: `calc(${100 / columns}% - 0.15rem)`,
                },
                'aria-label': `${item.title}, ${timeLabel(item)}`,
              }
              const content = (
                <>
                  <strong>{item.title}</strong>
                  <small>{[timeLabel(item), item.subtitle].filter(Boolean).join(' · ')}</small>
                </>
              )
              return item.href ? (
                <Block key={item.key} to={item.href} {...props}>
                  {content}
                </Block>
              ) : (
                // записи со временем почти всегда со ссылкой; без неё (например, праздник с часами) просто блок
                <PlainBlock key={item.key} {...props}>
                  {content}
                </PlainBlock>
              )
            })}
          </Lane>
          {isToday && <NowLine role="img" aria-label={`Сейчас ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`} style={{ top: rem(minutesOf(now) * REM_PER_MINUTE) }} />}
        </Strip>
      </Scroller>
    </>
  )
}
