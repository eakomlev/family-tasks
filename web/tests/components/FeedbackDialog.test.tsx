import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { ChatMessage } from '@/api'
import { FeedbackDialog } from '@/pages/ChatRoom/components/FeedbackDialog'

const message: ChatMessage = {
  id: 'm1',
  senderId: 'kid',
  text: 'Сдал контрольную по математике',
  createdAt: '2026-10-11T10:00:00Z',
  reactions: [],
  awards: [],
}

function setup(props: Partial<Parameters<typeof FeedbackDialog>[0]> = {}) {
  const onSubmit = vi.fn().mockResolvedValue(undefined)
  const onClose = vi.fn()
  render(<FeedbackDialog message={message} authorName="Миша" onSubmit={onSubmit} onClose={onClose} {...props} />)
  return { onSubmit, onClose, user: userEvent.setup() }
}

const send = () => screen.getByRole('button', { name: 'Отправить' })

describe('FeedbackDialog', () => {
  it('показывает, к чему относится: автор и текст сообщения; как модальное окно', () => {
    setup()
    expect(screen.getByRole('dialog', { name: /Миша/ })).toHaveAttribute('aria-modal', 'true')
    expect(screen.getByText('Сдал контрольную по математике')).toBeInTheDocument()
  })

  it('пока ничего не выбрано, отправить нельзя', () => {
    setup()
    expect(send()).toBeDisabled()
  })

  it('только реакция: уходит emoji без монет', async () => {
    const { onSubmit, user } = setup()
    await user.click(screen.getByRole('button', { name: 'Реакция 👏' }))
    expect(screen.getByRole('button', { name: 'Реакция 👏' })).toHaveAttribute('aria-pressed', 'true')
    await user.click(send())
    expect(onSubmit).toHaveBeenCalledWith({ emoji: '👏' })
  })

  it('можно выбрать только одну реакцию; повторное нажатие снимает выбор', async () => {
    const { user } = setup()
    await user.click(screen.getByRole('button', { name: 'Реакция 👍' }))
    await user.click(screen.getByRole('button', { name: 'Реакция 🔥' }))
    expect(screen.getByRole('button', { name: 'Реакция 👍' })).toHaveAttribute('aria-pressed', 'false')
    await user.click(screen.getByRole('button', { name: 'Реакция 🔥' }))
    expect(screen.getByRole('button', { name: 'Реакция 🔥' })).toHaveAttribute('aria-pressed', 'false')
    expect(send()).toBeDisabled()
  })

  it('только монеты по плашке: уходят монеты без реакции', async () => {
    const { onSubmit, user } = setup()
    await user.click(screen.getByRole('button', { name: '20' }))
    await user.click(send())
    expect(onSubmit).toHaveBeenCalledWith({ coins: 20 })
  })

  it('реакция и монеты вместе', async () => {
    const { onSubmit, user } = setup()
    await user.click(screen.getByRole('button', { name: 'Реакция ❤️' }))
    await user.click(screen.getByRole('button', { name: '50' }))
    await user.click(send())
    expect(onSubmit).toHaveBeenCalledWith({ emoji: '❤️', coins: 50 })
  })

  it('свои монеты: «Другая» и число; границы', async () => {
    const { onSubmit, user } = setup()
    await user.click(screen.getByRole('button', { name: 'Другая' }))
    expect(send()).toBeDisabled()
    await user.type(screen.getByLabelText('Своя награда, монет'), '1001')
    expect(send()).toBeDisabled()
    expect(screen.getByText(/целое число от 1 до 1000/)).toBeInTheDocument()
    await user.clear(screen.getByLabelText('Своя награда, монет'))
    await user.type(screen.getByLabelText('Своя награда, монет'), '37')
    expect(send()).toBeEnabled()
    await user.click(send())
    expect(onSubmit).toHaveBeenCalledWith({ coins: 37 })
  })

  it('уже поставленная мной реакция выбрана; без изменений отправить нельзя; снятие уходит как null', async () => {
    const { onSubmit, user } = setup({ myEmoji: '🎉' })
    expect(screen.getByRole('button', { name: 'Реакция 🎉' })).toHaveAttribute('aria-pressed', 'true')
    expect(send()).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Реакция 🎉' }))
    await user.click(send())
    expect(onSubmit).toHaveBeenCalledWith({ emoji: null })
  })

  it('начислить монеты можно, не трогая прежнюю реакцию: она не отправляется заново', async () => {
    const { onSubmit, user } = setup({ myEmoji: '🎉' })
    await user.click(screen.getByRole('button', { name: '10' }))
    await user.click(send())
    expect(onSubmit).toHaveBeenCalledWith({ coins: 10 })
  })

  it('ошибка отправки: окно остаётся, сообщение об ошибке, можно повторить', async () => {
    const onSubmit = vi.fn().mockRejectedValueOnce(new Error('x')).mockResolvedValueOnce(undefined)
    const { user } = setup({ onSubmit })
    await user.click(screen.getByRole('button', { name: '5' }))
    await user.click(send())
    expect(await screen.findByText(/Не удалось отправить/)).toBeInTheDocument()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    await waitFor(() => expect(send()).toBeEnabled())
    await user.click(send())
    expect(onSubmit).toHaveBeenCalledTimes(2)
  })

  it('закрывается кнопкой, Escape и нажатием на затемнение, но не нажатием внутри окна', async () => {
    const { onClose, user } = setup()
    await user.click(screen.getByRole('button', { name: 'Отмена' }))
    expect(onClose).toHaveBeenCalledTimes(1)
    await user.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledTimes(2)
    await user.click(screen.getByRole('dialog'))
    expect(onClose).toHaveBeenCalledTimes(2)
    await user.click(screen.getByRole('dialog').parentElement!)
    expect(onClose).toHaveBeenCalledTimes(3)
  })

  it('пока окно открыто, страница не прокручивается', () => {
    setup()
    expect(document.body.style.overflow).toBe('hidden')
  })
})
