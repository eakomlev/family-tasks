import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, type Member } from '@/api'
import { ConfirmProvider } from '@/components/ConfirmDialog'
import { TaskEditor } from '@/pages/TaskForm/components/TaskEditor'
import { emptyForm } from '@/pages/TaskForm/utils'

const members: Member[] = [
  { id: 'm1', name: 'Лена', role: 'mama', avatar: null, isOwner: true },
  { id: 'm2', name: 'Миша', role: 'child', avatar: null, isOwner: false },
]

function setup(props: Partial<Parameters<typeof TaskEditor>[0]> = {}) {
  const onSubmit = vi.fn().mockResolvedValue(undefined)
  render(
    <ConfirmProvider>
      <TaskEditor initial={emptyForm('m1')} members={members} me="m1" submitLabel="Создать" onSubmit={onSubmit} {...props} />
    </ConfirmProvider>,
  )
  return { onSubmit, user: userEvent.setup() }
}

afterEach(() => vi.restoreAllMocks())

describe('TaskEditor', () => {
  it('себя в списке исполнителей помечает «(я)»', () => {
    setup()
    expect(screen.getByRole('option', { name: 'Лена (я)' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Миша' })).toBeInTheDocument()
  })

  it('пустое название: ошибка и запрос не уходит', async () => {
    const { onSubmit, user } = setup()
    await user.click(screen.getByRole('button', { name: 'Создать' }))
    expect(screen.getByText('Введите название задания.')).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('ошибка пропадает, когда пользователь продолжает вводить', async () => {
    const { user } = setup()
    await user.click(screen.getByRole('button', { name: 'Создать' }))
    await user.type(screen.getByLabelText('Название'), 'a')
    expect(screen.queryByText('Введите название задания.')).not.toBeInTheDocument()
  })

  it('отправляет задание для выбранного участника', async () => {
    const { onSubmit, user } = setup()
    await user.type(screen.getByLabelText('Название'), '  Помыть посуду ')
    await user.selectOptions(screen.getByLabelText('Кому'), 'm2')
    await user.click(screen.getByRole('button', { name: 'Создать' }))
    expect(onSubmit).toHaveBeenCalledWith({
      title: 'Помыть посуду',
      assigneeId: 'm2',
      date: null,
      time: null,
      repeat: { type: 'none', days: [], until: null },
    })
  })

  it('время доступно только с датой, очистка даты сбрасывает время и повтор', async () => {
    const { user } = setup()
    const time = screen.getByLabelText('Время')
    expect(time).toBeDisabled()

    await user.type(screen.getByLabelText(/^Дата/), '2026-10-12')
    expect(time).toBeEnabled()
    await user.type(time, '18:30')
    await user.selectOptions(screen.getByLabelText('Повтор'), 'daily')

    await user.click(screen.getByRole('button', { name: 'Убрать дату' }))
    expect(screen.getByLabelText(/^Дата/)).toHaveValue('')
    expect(time).toBeDisabled()
    expect(time).toHaveValue('')
    expect(screen.getByLabelText('Повтор')).toHaveValue('none')
  })

  it('выбор повтора без даты подставляет сегодняшнюю', async () => {
    const { user } = setup()
    await user.selectOptions(screen.getByLabelText('Повтор'), 'daily')
    expect((screen.getByLabelText(/^Дата/) as HTMLInputElement).value).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('«по дням недели» выбирает день даты, дни переключаются и уходят отсортированными', async () => {
    const { onSubmit, user } = setup()
    await user.type(screen.getByLabelText('Название'), 'Зарядка')
    await user.type(screen.getByLabelText(/^Дата/), '2026-10-14') // среда
    await user.selectOptions(screen.getByLabelText('Повтор'), 'weekly')

    const wed = screen.getByRole('button', { name: 'Ср' })
    expect(wed).toHaveAttribute('aria-pressed', 'true')
    // нарочно не по порядку: список должен прийти отсортированным
    await user.click(screen.getByRole('button', { name: 'Пт' }))
    await user.click(screen.getByRole('button', { name: 'Пн' }))
    await user.click(wed)

    await user.click(screen.getByRole('button', { name: 'Создать' }))
    expect(onSubmit.mock.calls[0][0].repeat).toEqual({ type: 'weekly', days: [1, 5], until: null })
  })

  it('weekly без выбранных дней не отправляется', async () => {
    const { onSubmit, user } = setup()
    await user.type(screen.getByLabelText('Название'), 'Зарядка')
    await user.type(screen.getByLabelText(/^Дата/), '2026-10-14')
    await user.selectOptions(screen.getByLabelText('Повтор'), 'weekly')
    await user.click(screen.getByRole('button', { name: 'Ср' })) // снимаем единственный
    await user.click(screen.getByRole('button', { name: 'Создать' }))
    expect(screen.getByText('Выберите хотя бы один день недели.')).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('ошибки сервера объясняются по-русски и кнопка снова доступна', async () => {
    const onSubmit = vi.fn().mockRejectedValue(new ApiError(403, 'forbidden'))
    const { user } = setup({ onSubmit })
    await user.type(screen.getByLabelText('Название'), 'x')
    await user.click(screen.getByRole('button', { name: 'Создать' }))
    expect(await screen.findByText(/только тот, кто его создал/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Создать' })).toBeEnabled()
  })

  it('кнопки удаления нет у нового задания', () => {
    setup()
    expect(screen.queryByRole('button', { name: 'Удалить задание' })).not.toBeInTheDocument()
  })

  it('удаление требует подтверждения в окне приложения, а не в системном', async () => {
    const onDelete = vi.fn().mockResolvedValue(undefined)
    const { user } = setup({ onDelete })
    const systemConfirm = vi.spyOn(window, 'confirm')

    await user.click(screen.getByRole('button', { name: 'Удалить задание' }))
    expect(screen.getByRole('alertdialog', { name: 'Удалить задание?' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Отмена' }))
    expect(onDelete).not.toHaveBeenCalled()
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Удалить задание' }))
    await user.click(screen.getByRole('button', { name: 'Удалить' }))
    await waitFor(() => expect(onDelete).toHaveBeenCalledTimes(1))
    expect(systemConfirm).not.toHaveBeenCalled()
  })
})
