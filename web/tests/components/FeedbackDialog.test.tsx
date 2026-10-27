import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { ChatMessage } from '@/api'
import { FeedbackDialog } from '@/pages/ChatRoom/components/FeedbackDialog'

const message: ChatMessage = {
  id: 'm1',
  senderId: 'kid',
  text: 'Сдал контрольную по математике',
  caption: 'Сдал контрольную по математике',
  media: [],
  createdAt: '2026-10-11T10:00:00Z',
  reactions: [],
  awards: [],
}

function setup(props: Partial<Parameters<typeof FeedbackDialog>[0]> = {}) {
  const onSubmit = vi.fn().mockResolvedValue(undefined)
  const onClose = vi.fn()
  render(<FeedbackDialog message={message} authorName="Миша" canAward onSubmit={onSubmit} onClose={onClose} {...props} />)
  return { onSubmit, onClose, user: userEvent.setup() }
}

describe('FeedbackDialog', () => {
  it('компактное модальное окно: реакции и монеты, кнопок «Отправить» и «Отмена» нет', () => {
    setup()
    expect(screen.getByRole('dialog', { name: 'Реакция на сообщение' })).toHaveAttribute('aria-modal', 'true')
    expect(screen.getAllByRole('button', { name: /^Реакция / })).toHaveLength(8)
    expect(screen.queryByRole('button', { name: 'Отправить' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Отмена' })).not.toBeInTheDocument()
  })

  it('реакция применяется сразу одним нажатием', async () => {
    const { onSubmit, user } = setup()
    await user.click(screen.getByRole('button', { name: 'Реакция 👏' }))
    expect(onSubmit).toHaveBeenCalledTimes(1)
    expect(onSubmit).toHaveBeenCalledWith({ emoji: '👏' })
  })

  it('монеты применяются сразу одним нажатием', async () => {
    const { onSubmit, user } = setup()
    await user.click(screen.getByRole('button', { name: 'Начислить 20 монет' }))
    expect(onSubmit).toHaveBeenCalledWith({ coins: 20 })
    expect(screen.getAllByRole('button', { name: /^Начислить/ })).toHaveLength(5)
  })

  it('без права начислять монет в окне нет', () => {
    setup({ canAward: false })
    expect(screen.queryByRole('group', { name: 'Монеты' })).not.toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /^Реакция / })).toHaveLength(8)
  })

  it('своя прежняя реакция отмечена; нажатие на неё снимает (уходит null)', async () => {
    const { onSubmit, user } = setup({ myEmoji: '🎉' })
    expect(screen.getByRole('button', { name: 'Реакция 🎉' })).toHaveAttribute('aria-pressed', 'true')
    await user.click(screen.getByRole('button', { name: 'Реакция 🎉' }))
    expect(onSubmit).toHaveBeenCalledWith({ emoji: null })
  })

  it('другая реакция заменяет прежнюю', async () => {
    const { onSubmit, user } = setup({ myEmoji: '🎉' })
    await user.click(screen.getByRole('button', { name: 'Реакция 🔥' }))
    expect(onSubmit).toHaveBeenCalledWith({ emoji: '🔥' })
  })

  it('ошибка: сообщение, окно остаётся, можно повторить', async () => {
    const onSubmit = vi.fn().mockRejectedValueOnce(new Error('x')).mockResolvedValueOnce(undefined)
    const { user } = setup({ onSubmit })
    await user.click(screen.getByRole('button', { name: 'Начислить 5 монет' }))
    expect(await screen.findByText(/Не удалось отправить/)).toBeInTheDocument()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Начислить 5 монет' })).toBeEnabled())
    await user.click(screen.getByRole('button', { name: 'Начислить 5 монет' }))
    expect(onSubmit).toHaveBeenCalledTimes(2)
  })

  it('закрывается Escape и нажатием на затемнение, но не нажатием внутри окна', async () => {
    const { onClose, user } = setup()
    await user.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledTimes(1)
    await user.click(screen.getByRole('dialog'))
    expect(onClose).toHaveBeenCalledTimes(1)
    await user.click(screen.getByRole('dialog').parentElement!)
    expect(onClose).toHaveBeenCalledTimes(2)
  })

  it('пока окно открыто, страница не прокручивается', () => {
    setup()
    expect(document.body.style.overflow).toBe('hidden')
  })

  it("«Копировать» копирует и закрывает окно", async () => {
    const onCopy = vi.fn().mockResolvedValue(undefined)
    const { onClose, user } = setup({ onCopy })
    await user.click(screen.getByRole('button', { name: 'Копировать' }))
    expect(onCopy).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(onClose).toHaveBeenCalled())
  })

  it('«Переслать» передаёт управление', async () => {
    const onForward = vi.fn()
    const { user } = setup({ onForward })
    await user.click(screen.getByRole('button', { name: 'Переслать' }))
    expect(onForward).toHaveBeenCalledTimes(1)
  })

  it('если копирование не удалось, окно остаётся и показывает ошибку', async () => {
    const { onClose, user } = setup({ onCopy: vi.fn().mockRejectedValue(new Error('no')) })
    await user.click(screen.getByRole('button', { name: 'Копировать' }))
    expect(await screen.findByText('Не удалось скопировать.')).toBeInTheDocument()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('без текста (одни вложения) кнопок нет', () => {
    setup()
    expect(screen.queryByRole('button', { name: 'Копировать' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Переслать' })).not.toBeInTheDocument()
  })
})
