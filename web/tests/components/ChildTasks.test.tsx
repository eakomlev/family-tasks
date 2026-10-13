import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { ChildCard } from '@/pages/MyDay/components/FamilyLessons/components/ChildCard'
import { ChildTasks } from '@/pages/MyDay/components/FamilyLessons/components/ChildCard/components/ChildTasks'
import { occ, task } from '../helpers'

const entry = (id: string, title: string, over: { time?: string | null; done?: boolean; date?: string | null } = {}) => ({
  task: task({ id, title, time: over.time ?? null }),
  occurrence: occ(id, over.date === undefined ? '2026-10-11' : over.date, over.done),
})

const renderTasks = (today: ReturnType<typeof entry>[] | undefined, undated: ReturnType<typeof entry>[] = []) =>
  render(<MemoryRouter><ChildTasks tasks={today && { today, undated }} /></MemoryRouter>)

describe('ChildTasks', () => {
  it('пока грузится, ничего не показывает', () => {
    const { container } = renderTasks(undefined)
    expect(container).toBeEmptyDOMElement()
  })

  it('без заданий блока нет совсем: ни заголовка, ни «Заданий нет»', () => {
    const { container } = renderTasks([])
    expect(container).toBeEmptyDOMElement()
    expect(screen.queryByText('Задания на сегодня')).not.toBeInTheDocument()
    expect(screen.queryByText(/Заданий нет/)).not.toBeInTheDocument()
  })

  it('показывает и невыполненные, и выполненные, со счётчиком', () => {
    renderTasks([entry('a', 'Собрать портфель', { time: '19:00' }), entry('b', 'Покормить кота', { done: true })])
    expect(screen.getByText('выполнено 1 из 2')).toBeInTheDocument()
    const links = screen.getAllByRole('link')
    expect(links).toHaveLength(2)
    expect(links[0]).toHaveAttribute('href', '/tasks/a?date=2026-10-11')
    expect(links[0]).toHaveTextContent('19:00')
    // выполненное остаётся в списке, помечено для скринридера
    expect(within(links[1]).getByText(/Покормить кота/)).toBeInTheDocument()
    expect(links[1]).toHaveAccessibleName(/^Выполнено:\s*Покормить кота/)
    expect(links[0]).not.toHaveAccessibleName(/Выполнено/)
  })

  it('задания без срока идут тем же списком после сегодняшних, ссылка без даты, входят в счётчик', () => {
    renderTasks([entry('a', 'Сегодняшнее', { done: true })], [entry('u', 'Разобрать полку', { date: null })])
    expect(screen.queryByText('Без срока')).not.toBeInTheDocument()
    expect(screen.getByText('выполнено 1 из 2')).toBeInTheDocument()
    const titles = screen.getAllByRole('link').map((l) => l.textContent ?? '')
    expect(titles.findIndex((x) => x.includes('Сегодняшнее'))).toBeLessThan(titles.findIndex((x) => x.includes('Разобрать полку')))
    expect(screen.getByRole('link', { name: /Разобрать полку/ })).toHaveAttribute('href', '/tasks/u')
    expect(screen.getByRole('link', { name: /Сегодняшнее/ })).toHaveAttribute('href', '/tasks/a?date=2026-10-11')
  })

  it('только задания без срока: они в списке, «Заданий нет» не пишем', () => {
    renderTasks([], [entry('u', 'Разобрать полку', { date: null })])
    expect(screen.queryByText('Заданий нет.')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Разобрать полку/ })).toBeInTheDocument()
    expect(screen.getByText('выполнено 0 из 1')).toBeInTheDocument()
  })

  it('все выполнены: «выполнено 2 из 2»', () => {
    renderTasks([entry('a', 'А', { done: true }), entry('b', 'Б', { done: true })])
    expect(screen.getByText('выполнено 2 из 2')).toBeInTheDocument()
  })
})

describe('ChildCard с заданиями', () => {
  const child = { id: 'c1', name: 'Миша', role: 'child' as const, avatar: null, isOwner: false }

  it('ссылка на расписание и ссылки на задания не вложены друг в друга', () => {
    render(
      <MemoryRouter>
        <ChildCard child={child} lessons={[]} tasks={{ today: [entry('a', 'Собрать портфель')], undated: [] }} now={new Date(2026, 9, 11, 10)} />
      </MemoryRouter>,
    )
    const schedule = screen.getByRole('link', { name: /Миша/ })
    expect(schedule).toHaveAttribute('href', '/family/c1')
    expect(schedule).not.toContainElement(screen.getByRole('link', { name: /Собрать портфель/ }))
    expect(screen.getByRole('link', { name: /Собрать портфель/ })).toHaveAttribute('href', '/tasks/a?date=2026-10-11')
  })

  it('без загруженных заданий блока заданий нет', () => {
    render(
      <MemoryRouter>
        <ChildCard child={child} lessons={[]} now={new Date(2026, 9, 11, 10)} />
      </MemoryRouter>,
    )
    expect(screen.queryByText('Задания на сегодня')).not.toBeInTheDocument()
  })
})

describe('ChildCard: кабинеты уроков', () => {
  const child = { id: 'c1', name: 'Миша', role: 'child' as const, avatar: null, isOwner: false }
  // 11 октября 2026 это воскресенье, поэтому показывается понедельник (weekday 1)
  const lessons = [
    { weekday: 1, subject: 'Химия', startsAt: null, endsAt: null, room: '12а' },
    { weekday: 1, subject: 'Физика', startsAt: null, endsAt: null, room: null },
  ]

  it('уроки в столбик, у предмета с кабинетом он указан рядом, у остальных нет', () => {
    render(
      <MemoryRouter>
        <ChildCard child={child} lessons={lessons} now={new Date(2026, 9, 11, 10)} />
      </MemoryRouter>,
    )
    // уроки столбиком: у каждого своя строка, кабинет рядом с предметом
    const rows = within(screen.getByRole('list', { name: 'Уроки: Миша' })).getAllByRole('listitem')
    expect(rows).toHaveLength(2)
    expect(rows[0]).toHaveTextContent('1Химия')
    expect(rows[0]).toHaveTextContent('каб. 12а')
    expect(rows[1]).toHaveTextContent('2Физика')
    expect(rows[1]).not.toHaveTextContent('каб.')
  })
})
