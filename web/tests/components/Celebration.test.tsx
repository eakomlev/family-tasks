import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Celebration } from '@/components/Celebration'
import { EMOJIS, PRAISES, pick } from '@/components/Celebration/utils'

function setup() {
  const onClose = vi.fn()
  render(<Celebration title="Вынести мусор" onClose={onClose} />)
  return { onClose, user: userEvent.setup() }
}

describe('Celebration', () => {
  it('поздравляет и называет задание, перекрывая всю страницу как диалог', () => {
    setup()
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(PRAISES).toContain(screen.getByRole('heading').textContent)
    expect(screen.getByText('Задание «Вынести мусор» выполнено.')).toBeInTheDocument()
  })

  it('фокус на кнопке, кнопка и Escape закрывают', async () => {
    const { onClose, user } = setup()
    const button = screen.getByRole('button', { name: 'Отлично' })
    expect(button).toHaveFocus()
    await user.click(button)
    expect(onClose).toHaveBeenCalledTimes(1)
    await user.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledTimes(2)
  })

  it('пока открыто, страница не прокручивается', () => {
    const { unmount } = render(<Celebration title="x" onClose={() => {}} />)
    expect(document.body.style.overflow).toBe('hidden')
    unmount()
    expect(document.body.style.overflow).toBe('')
  })

  it('рисует конфетти-холст поверх страницы, не перехватывающий клики', () => {
    setup()
    const canvas = document.querySelector('canvas')!
    expect(canvas).toBeInTheDocument()
    expect(canvas.style.pointerEvents).toBe('none')
  })

  it('pick выбирает элемент по случайному числу', () => {
    expect(pick(EMOJIS, () => 0)).toBe(EMOJIS[0])
    expect(pick(EMOJIS, () => 0.999)).toBe(EMOJIS[EMOJIS.length - 1])
  })
})
