import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { TaskItem } from '@/components/TaskItem'
import { occ, task } from '../helpers'

const member = { id: 'm2', name: 'Миша', role: 'child' as const, avatar: null, isOwner: false }

function renderItem(props: Partial<Parameters<typeof TaskItem>[0]> = {}) {
  const onToggle = vi.fn()
  render(
    <MemoryRouter>
      <TaskItem
        task={task({ id: 'a', title: 'Вынести мусор' })}
        occurrence={occ('a', '2026-10-11')}
        today="2026-10-11"
        onToggle={onToggle}
        {...props}
      />
    </MemoryRouter>,
  )
  return { onToggle }
}

describe('TaskItem', () => {
  it('название ведёт на страницу задания', () => {
    renderItem()
    expect(screen.getByRole('link', { name: 'Вынести мусор' })).toHaveAttribute('href', '/tasks/a')
  })

  it('невыполненное: флажок выключен, клик вызывает onToggle', async () => {
    const { onToggle } = renderItem()
    const box = screen.getByRole('checkbox', { name: 'Отметить выполненным: Вынести мусор' })
    expect(box).toHaveAttribute('aria-checked', 'false')
    await userEvent.click(box)
    expect(onToggle).toHaveBeenCalledTimes(1)
  })

  it('выполненное: флажок включён, подпись «Снять отметку»', () => {
    renderItem({ occurrence: occ('a', '2026-10-11', true) })
    const box = screen.getByRole('checkbox', { name: 'Снять отметку: Вынести мусор' })
    expect(box).toHaveAttribute('aria-checked', 'true')
    expect(box).toHaveTextContent('✓')
  })

  it('заблокированный флажок не реагирует', async () => {
    const { onToggle } = renderItem({ disabled: true })
    await userEvent.click(screen.getByRole('checkbox'))
    expect(onToggle).not.toHaveBeenCalled()
  })

  it('показывает просрочку, исполнителя и кто выполнил', () => {
    renderItem({
      occurrence: occ('a', '2026-10-09'),
      assignee: member,
      doneBy: { ...member, name: 'Аня' },
    })
    expect(screen.getByText('Просрочено, 9 октября')).toBeInTheDocument()
    expect(screen.getByText('Миша')).toBeInTheDocument()
    expect(screen.getByText('выполнил(а): Аня')).toBeInTheDocument()
  })

  it('без срока, повтора и исполнителя подписи нет', () => {
    renderItem({ occurrence: occ('a', null) })
    expect(screen.queryByText(/Просрочено/)).not.toBeInTheDocument()
  })
})
