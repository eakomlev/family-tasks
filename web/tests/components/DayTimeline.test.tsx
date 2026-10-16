import { cleanup, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CalendarItem } from '@/lib/calendar'
import { DayTimeline } from '@/pages/Calendar/components/DayTimeline'

const item = (key: string, over: Partial<CalendarItem> = {}): CalendarItem => ({
  key,
  kind: 'event',
  title: key,
  date: '2026-11-07',
  start: null,
  end: null,
  memberIds: [],
  href: `/calendar/events/${key}`,
  ...over,
})

const noon = new Date(2026, 10, 7, 12, 30)
const view = (items: CalendarItem[], isToday = false) =>
  render(
    <MemoryRouter>
      <DayTimeline day="2026-11-07" items={items} now={noon} isToday={isToday} />
    </MemoryRouter>,
  )

beforeEach(() => {
  Element.prototype.scrollTo = vi.fn() as unknown as typeof Element.prototype.scrollTo
  // шрифт документа для перевода rem в пиксели при прокрутке
  document.documentElement.style.fontSize = '16px'
})
afterEach(cleanup)

describe('вид «День»: полоса суток', () => {
  it('24 часовые отметки и блок записи в нужном месте и нужной высоты', () => {
    view([item('театр', { start: '18:00', end: '20:30' })])
    const strip = screen.getByRole('group', { name: 'Сутки по часам' })
    expect(within(strip).getAllByText(/^\d\d:00$/)).toHaveLength(24)
    const block = screen.getByRole('link', { name: 'театр, 18:00–20:30' })
    // час 3.6rem: 18:00 = 64.8rem от начала суток, 2,5 часа = 9rem (минус зазор)
    expect(block).toHaveStyle({ top: '64.8rem', height: '8.9rem', left: '0%', width: 'calc(100% - 0.15rem)' })
    expect(block).toHaveAttribute('href', '/calendar/events/театр')
    expect(block).toHaveTextContent('18:00–20:30')
  })

  it('записи на весь день не на полосе, а списком сверху', () => {
    view([item('праздник', { kind: 'holiday', href: null }), item('отпуск'), item('встреча', { start: '10:00', end: '11:00' })])
    expect(screen.getByText('праздник')).toBeInTheDocument()
    const strip = screen.getByRole('group', { name: 'Сутки по часам' })
    expect(within(strip).queryByText('праздник')).not.toBeInTheDocument()
    expect(within(strip).queryByText('отпуск')).not.toBeInTheDocument()
    expect(within(strip).getByText('встреча')).toBeInTheDocument()
  })

  it('пересекающиеся записи стоят рядом колонками', () => {
    view([item('a', { start: '10:00', end: '12:00' }), item('b', { start: '11:00', end: '12:30' })])
    expect(screen.getByRole('link', { name: 'a, 10:00–12:00' })).toHaveStyle({ left: '0%', width: 'calc(50% - 0.15rem)' })
    expect(screen.getByRole('link', { name: 'b, 11:00–12:30' })).toHaveStyle({ left: '50%', width: 'calc(50% - 0.15rem)' })
  })

  it('красная линия «сейчас» только в сегодняшнем дне и в нужном месте', () => {
    const { unmount } = view([], true)
    // 12:30 = 750 минут × 0,06rem
    expect(screen.getByRole('img', { name: 'Сейчас 12:30' })).toHaveStyle({ top: '45rem' })
    unmount()
    view([], false)
    expect(screen.queryByRole('img', { name: /Сейчас/ })).not.toBeInTheDocument()
  })

  it('полоса открывается на сегодняшнем времени (за час до сейчас), иначе на первой записи, иначе на утре', () => {
    const scrollTo = vi.fn()
    Element.prototype.scrollTo = scrollTo as unknown as typeof Element.prototype.scrollTo
    const px = (minutes: number) => minutes * (3.6 / 60) * 16
    const { unmount } = view([], true)
    expect(scrollTo).toHaveBeenLastCalledWith({ top: px(690), behavior: 'auto' })
    unmount()
    const second = view([item('a', { start: '15:00', end: '16:00' })])
    expect(scrollTo).toHaveBeenLastCalledWith({ top: px(870), behavior: 'auto' })
    second.unmount()
    view([])
    expect(scrollTo).toHaveBeenLastCalledWith({ top: px(480), behavior: 'auto' })
  })

  it('запись без ссылки показывается обычным блоком', () => {
    view([item('без ссылки', { start: '09:00', end: '10:00', href: null })])
    expect(screen.queryByRole('link', { name: /без ссылки/ })).not.toBeInTheDocument()
    expect(screen.getByLabelText('без ссылки, 09:00–10:00')).toBeInTheDocument()
  })
})
