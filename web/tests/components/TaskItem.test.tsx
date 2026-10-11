import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { TaskItem } from '@/components/TaskItem'
import { occ, task } from '../helpers'

const member = { id: 'm2', name: 'Миша', role: 'child' as const, avatar: null, isOwner: false }

function renderItem(props: Partial<Parameters<typeof TaskItem>[0]> = {}) {
  return render(
    <MemoryRouter>
      <TaskItem
        task={task({ id: 'a', title: 'Вынести мусор' })}
        occurrence={occ('a', '2026-10-11')}
        today="2026-10-11"
        {...props}
      />
    </MemoryRouter>,
  )
}

describe('TaskItem', () => {
  it('вся карточка — одна ссылка на страницу задания с днём вхождения', () => {
    renderItem({ assignee: member, showAssignee: true })
    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('href', '/tasks/a?date=2026-10-11')
    // название, подписи и исполнитель лежат внутри ссылки, отдельных кнопок и флажков нет
    expect(link).toHaveTextContent('Вынести мусор')
    expect(link).toHaveTextContent('Миша')
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('награда видна в подписи карточки; без награды её нет', () => {
    const { unmount } = renderItem({ task: task({ id: 'a', title: 'Вынести мусор', reward: 20 }) })
    expect(screen.getByRole('link')).toHaveTextContent('+20 монет')
    unmount()
    renderItem()
    expect(screen.getByRole('link')).not.toHaveTextContent('монет')
  })

  it('у задания без срока в ссылке нет даты', () => {
    renderItem({ occurrence: occ('a', null) })
    expect(screen.getByRole('link')).toHaveAttribute('href', '/tasks/a')
  })

  it('состояние видно и скринридеру: выполнено и просрочено', () => {
    const { unmount } = renderItem({ occurrence: occ('a', '2026-10-11', true) })
    expect(screen.getByRole('link', { name: /^Выполнено:\s*Вынести мусор/ })).toBeInTheDocument()
    unmount()
    renderItem({ occurrence: occ('a', '2026-10-09') })
    expect(screen.getByRole('link', { name: /^Просрочено:\s*Вынести мусор/ })).toBeInTheDocument()
  })

  it('у невыполненного актуального задания служебной подписи нет', () => {
    renderItem()
    expect(screen.getByRole('link', { name: /^Вынести мусор/ })).toBeInTheDocument()
  })

  it('показывает просрочку и исполнителя', () => {
    renderItem({ occurrence: occ('a', '2026-10-09'), assignee: member, showAssignee: true })
    expect(screen.getByText('Просрочено, 9 октября')).toBeInTheDocument()
    expect(screen.getByText('Миша')).toBeInTheDocument()
  })

  it('у выполненного: кто и когда отметил', () => {
    renderItem({ occurrence: occ('a', '2026-10-09', true), doneBy: { ...member, name: 'Аня' } })
    // occ(): отметка 2026-10-11 10:00 UTC, часовой пояс тестов Москва
    expect(screen.getByText('выполнил(а): Аня, 11 октября, 13:00')).toBeInTheDocument()
  })

  it('имя исполнителя скрыто без showAssignee', () => {
    renderItem({ assignee: member })
    expect(screen.queryByText('Миша')).not.toBeInTheDocument()
  })

  describe('подпись автора', () => {
    const mama = { ...member, id: 'm1', name: 'Лена', role: 'mama' as const }
    const papa = { ...member, id: 'm3', name: 'Игорь', role: 'papa' as const }
    const sister = { ...member, id: 'm4', name: 'Аня' }
    const parent = { ...mama, id: 'm5', name: 'Мама-2' }

    it('ребёнку от мамы: «от мамы»', () => {
      renderItem({ task: task({ id: 'a', authorId: 'm1', assigneeId: 'm2' }), assignee: member, author: mama })
      expect(screen.getByText('от мамы')).toBeInTheDocument()
    })

    it('ребёнку от папы: «от папы»', () => {
      renderItem({ task: task({ id: 'a', authorId: 'm3', assigneeId: 'm2' }), assignee: member, author: papa })
      expect(screen.getByText('от папы')).toBeInTheDocument()
    })

    it('ребёнку от другого ребёнка: по имени', () => {
      renderItem({ task: task({ id: 'a', authorId: 'm4', assigneeId: 'm2' }), assignee: member, author: sister })
      expect(screen.getByText('от Аня')).toBeInTheDocument()
    })

    it('родителю от родителя: по имени', () => {
      renderItem({ task: task({ id: 'a', authorId: 'm1', assigneeId: 'm5' }), assignee: parent, author: mama })
      expect(screen.getByText('от Лена')).toBeInTheDocument()
    })

    it('своё задание без подписи', () => {
      renderItem({ task: task({ id: 'a', authorId: 'm2', assigneeId: 'm2' }), assignee: member, author: member })
      expect(screen.queryByText(/^от /)).not.toBeInTheDocument()
    })

    it('без исполнителя в данных подписи нет', () => {
      renderItem({ task: task({ id: 'a', authorId: 'm1', assigneeId: 'm2' }), author: mama })
      expect(screen.queryByText(/^от /)).not.toBeInTheDocument()
    })
  })

  it('дату вхождения показываем по запросу', () => {
    renderItem({ showDate: true, occurrence: occ('a', '2026-10-09', true) })
    expect(screen.getByText('9 октября')).toBeInTheDocument()
  })

  it('без срока, повтора и исполнителя подписи нет', () => {
    renderItem({ occurrence: occ('a', null) })
    expect(screen.queryByText(/Просрочено/)).not.toBeInTheDocument()
  })
})
