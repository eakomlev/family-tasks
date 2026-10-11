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

  it('без заданий: «Заданий нет.»', () => {
    renderTasks([])
    expect(screen.getByText('Задания на сегодня')).toBeInTheDocument()
    expect(screen.getByText('Заданий нет.')).toBeInTheDocument()
    expect(screen.queryByText(/выполнено \d/)).not.toBeInTheDocument()
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

  it('задания без срока идут отдельной группой, ссылка без даты, в счётчик «выполнено» не входят', () => {
    renderTasks([entry('a', 'Сегодняшнее', { done: true })], [entry('u', 'Разобрать полку', { date: null })])
    expect(screen.getByText('Без срока')).toBeInTheDocument()
    expect(screen.getByText('выполнено 1 из 1')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Разобрать полку/ })).toHaveAttribute('href', '/tasks/u')
    expect(screen.getByRole('link', { name: /Сегодняшнее/ })).toHaveAttribute('href', '/tasks/a?date=2026-10-11')
  })

  it('на сегодня нет, но есть без срока: так и написано, группа «Без срока» видна', () => {
    renderTasks([], [entry('u', 'Разобрать полку', { date: null })])
    expect(screen.getByText('На сегодня заданий нет.')).toBeInTheDocument()
    expect(screen.queryByText('Заданий нет.')).not.toBeInTheDocument()
    expect(screen.getByText('Без срока')).toBeInTheDocument()
    expect(screen.queryByText(/выполнено \d/)).not.toBeInTheDocument()
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
    expect(schedule).toHaveAttribute('href', '/family/c1/schedule')
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
