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
      description: '',
      reward: 0,
      assigneeId: 'm2',
      date: null,
      time: null,
      repeat: { type: 'none', days: [], until: null },
    })
  })

  describe('награда монетами', () => {
    const group = () => screen.queryByRole('group', { name: 'Награда' })
    const chip = (name: string | RegExp) => screen.getByRole('button', { name })
    const custom = () => screen.queryByLabelText('Своя награда, монет') as HTMLInputElement | null

    it('ребёнок награду не назначает: плашек нет ни при задании себе, ни при задании другому ребёнку', async () => {
      const kidMembers: Member[] = [...members, { id: 'm3', name: 'Аня', role: 'child', avatar: null, isOwner: false }]
      render(
        <ConfirmProvider>
          <TaskEditor initial={emptyForm('m2')} members={kidMembers} me="m2" submitLabel="Создать" onSubmit={vi.fn()} />
        </ConfirmProvider>,
      )
      expect(group()).not.toBeInTheDocument()
      await userEvent.selectOptions(screen.getByLabelText('Кому'), 'm3')
      expect(group()).not.toBeInTheDocument()
    })

    it('плашек нет, пока исполнитель взрослый (я)', () => {
      setup()
      expect(group()).not.toBeInTheDocument()
    })

    it('для ребёнка появляются плашки: «Без награды» выбрана, готовые числа и «Другая»', async () => {
      const { user } = setup()
      await user.selectOptions(screen.getByLabelText('Кому'), 'm2')
      expect(group()).toBeInTheDocument()
      expect(chip('Без награды')).toHaveAttribute('aria-pressed', 'true')
      for (const label of ['5', '10', '20', '50', '100', 'Другая']) {
        expect(chip(label)).toHaveAttribute('aria-pressed', 'false')
      }
      expect(custom()).not.toBeInTheDocument()
    })

    it('выбранная плашка уходит вместе с заданием, выбрана может быть только одна', async () => {
      const { onSubmit, user } = setup()
      await user.type(screen.getByLabelText('Название'), 'Уборка')
      await user.selectOptions(screen.getByLabelText('Кому'), 'm2')
      await user.click(chip('20'))
      await user.click(chip('50'))
      expect(chip('20')).toHaveAttribute('aria-pressed', 'false')
      expect(chip('50')).toHaveAttribute('aria-pressed', 'true')
      await user.click(screen.getByRole('button', { name: 'Создать' }))
      expect(onSubmit.mock.calls[0][0]).toMatchObject({ assigneeId: 'm2', reward: 50 })
    })

    it('«Другая» открывает поле для своего числа', async () => {
      const { onSubmit, user } = setup()
      await user.type(screen.getByLabelText('Название'), 'Уборка')
      await user.selectOptions(screen.getByLabelText('Кому'), 'm2')
      await user.click(chip('Другая'))
      expect(chip('Другая')).toHaveAttribute('aria-pressed', 'true')
      expect(custom()).toBeInTheDocument()
      expect(custom()).toHaveFocus()
      await user.type(custom()!, '37')
      await user.click(screen.getByRole('button', { name: 'Создать' }))
      expect(onSubmit.mock.calls[0][0]).toMatchObject({ reward: 37 })
    })

    it('возврат на готовую плашку прячет поле своего числа', async () => {
      const { user } = setup()
      await user.selectOptions(screen.getByLabelText('Кому'), 'm2')
      await user.click(chip('Другая'))
      await user.click(chip('10'))
      expect(custom()).not.toBeInTheDocument()
      expect(chip('Другая')).toHaveAttribute('aria-pressed', 'false')
    })

    it.each([['', 'пусто'], ['0', 'ноль'], ['1001', 'больше 1000'], ['2.5', 'дробное'], ['-5', 'отрицательное']])(
      'своя награда «%s» (%s) не отправляется, показана ошибка',
      async (text) => {
        const { onSubmit, user } = setup()
        await user.type(screen.getByLabelText('Название'), 'Уборка')
        await user.selectOptions(screen.getByLabelText('Кому'), 'm2')
        await user.click(chip('Другая'))
        if (text) await user.type(custom()!, text)
        await user.click(screen.getByRole('button', { name: 'Создать' }))
        expect(screen.getByText('Награда: целое число от 1 до 1000 монет.')).toBeInTheDocument()
        expect(onSubmit).not.toHaveBeenCalled()
      },
    )

    it('границы 1 и 1000 принимаются', async () => {
      const { onSubmit, user } = setup()
      await user.type(screen.getByLabelText('Название'), 'Уборка')
      await user.selectOptions(screen.getByLabelText('Кому'), 'm2')
      await user.click(chip('Другая'))
      await user.type(custom()!, '1000')
      await user.click(screen.getByRole('button', { name: 'Создать' }))
      expect(onSubmit.mock.calls[0][0]).toMatchObject({ reward: 1000 })
    })

    it('смена исполнителя на взрослого прячет плашки и сбрасывает награду, в том числе свою', async () => {
      const { onSubmit, user } = setup()
      await user.type(screen.getByLabelText('Название'), 'Уборка')
      await user.selectOptions(screen.getByLabelText('Кому'), 'm2')
      await user.click(chip('Другая'))
      await user.type(custom()!, '77')
      await user.selectOptions(screen.getByLabelText('Кому'), 'm1')
      expect(group()).not.toBeInTheDocument()
      await user.click(screen.getByRole('button', { name: 'Создать' }))
      expect(onSubmit.mock.calls[0][0]).toMatchObject({ assigneeId: 'm1', reward: 0 })
    })

    it('награда вне готовых плашек (заданная раньше) показана как «Другая» с этим числом', () => {
      setup({ initial: { ...emptyForm('m2'), assigneeId: 'm2', reward: '25', rewardCustom: true } })
      expect(chip('Другая')).toHaveAttribute('aria-pressed', 'true')
      expect(custom()).toHaveValue(25)
    })
  })

  it('описание обрезается и уходит вместе с заданием', async () => {
    const { onSubmit, user } = setup()
    await user.type(screen.getByLabelText('Название'), 'Уборка')
    await user.type(screen.getByLabelText(/^Описание/), '  Пропылесосить\nи протереть пыль ')
    await user.click(screen.getByRole('button', { name: 'Создать' }))
    expect(onSubmit.mock.calls[0][0].description).toBe('Пропылесосить\nи протереть пыль')
  })

  describe('«Указать время»', () => {
    const toggle = () => screen.getByRole('checkbox', { name: 'Указать время' }) as HTMLInputElement

    it('по умолчанию галочки нет, даты, времени и повтора не видно', () => {
      setup()
      expect(toggle().checked).toBe(false)
      expect(screen.queryByLabelText(/^Дата/)).not.toBeInTheDocument()
      expect(screen.queryByLabelText(/^Время/)).not.toBeInTheDocument()
      expect(screen.queryByLabelText('Повтор')).not.toBeInTheDocument()
    })

    it('без галочки задание уходит без срока', async () => {
      const { onSubmit, user } = setup()
      await user.type(screen.getByLabelText('Название'), 'Без срока')
      await user.click(screen.getByRole('button', { name: 'Создать' }))
      expect(onSubmit.mock.calls[0][0]).toMatchObject({ date: null, time: null, repeat: { type: 'none', days: [], until: null } })
    })

    it('с галочкой появляются дата (уже сегодняшняя), время и повтор', async () => {
      const { user } = setup()
      await user.click(toggle())
      expect(screen.getByLabelText(/^Дата/)).toHaveValue(new Date().toLocaleDateString('sv-SE'))
      expect(screen.getByLabelText(/^Время/)).toBeInTheDocument()
      expect(screen.getByLabelText('Повтор')).toBeInTheDocument()
    })

    it('время необязательно: только дата отправляется без времени', async () => {
      const { onSubmit, user } = setup()
      await user.type(screen.getByLabelText('Название'), 'Дата')
      await user.click(toggle())
      await user.clear(screen.getByLabelText(/^Дата/))
      await user.type(screen.getByLabelText(/^Дата/), '2026-10-12')
      await user.click(screen.getByRole('button', { name: 'Создать' }))
      expect(onSubmit.mock.calls[0][0]).toMatchObject({ date: '2026-10-12', time: null })
    })

    it('дата и время отправляются; снятие галочки убирает дату, время и повтор', async () => {
      const { onSubmit, user } = setup()
      await user.type(screen.getByLabelText('Название'), 'Что-то')
      await user.click(toggle())
      await user.clear(screen.getByLabelText(/^Дата/))
      await user.type(screen.getByLabelText(/^Дата/), '2026-10-12')
      await user.type(screen.getByLabelText(/^Время/), '18:30')
      await user.selectOptions(screen.getByLabelText('Повтор'), 'daily')

      await user.click(toggle())
      expect(screen.queryByLabelText(/^Дата/)).not.toBeInTheDocument()
      await user.click(screen.getByRole('button', { name: 'Создать' }))
      expect(onSubmit.mock.calls[0][0]).toMatchObject({ date: null, time: null, repeat: { type: 'none' } })

      // вернули галочку: поля начинаются заново, а не помнят прежние значения
      await user.click(toggle())
      expect(screen.getByLabelText(/^Время/)).toHaveValue('')
      expect(screen.getByLabelText('Повтор')).toHaveValue('none')
    })

    it('с галочкой, но с очищенной датой: ошибка, запрос не уходит', async () => {
      const { onSubmit, user } = setup()
      await user.type(screen.getByLabelText('Название'), 'Что-то')
      await user.click(toggle())
      await user.clear(screen.getByLabelText(/^Дата/))
      await user.click(screen.getByRole('button', { name: 'Создать' }))
      expect(screen.getByText(/Укажите дату или уберите галочку/)).toBeInTheDocument()
      expect(onSubmit).not.toHaveBeenCalled()
    })

    it('у задания с датой галочка стоит сразу', () => {
      setup({ initial: { ...emptyForm('m1'), scheduled: true, date: '2026-10-12', time: '09:00' } })
      expect(toggle().checked).toBe(true)
      expect(screen.getByLabelText(/^Время/)).toHaveValue('09:00')
    })

    it('выбор повтора подставляет сегодняшнюю дату, если её очистили', async () => {
      const { user } = setup()
      await user.click(toggle())
      await user.clear(screen.getByLabelText(/^Дата/))
      await user.selectOptions(screen.getByLabelText('Повтор'), 'daily')
      expect((screen.getByLabelText(/^Дата/) as HTMLInputElement).value).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    })
  })

  it('«по дням недели» выбирает день даты, дни переключаются и уходят отсортированными', async () => {
    const { onSubmit, user } = setup()
    await user.type(screen.getByLabelText('Название'), 'Зарядка')
    await user.click(screen.getByRole('checkbox', { name: 'Указать время' }))
    await user.clear(screen.getByLabelText(/^Дата/))
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
    await user.click(screen.getByRole('checkbox', { name: 'Указать время' }))
    await user.clear(screen.getByLabelText(/^Дата/))
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
