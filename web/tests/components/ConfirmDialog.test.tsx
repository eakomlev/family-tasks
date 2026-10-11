import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ConfirmProvider } from '@/components/ConfirmDialog'
import { useConfirm } from '@/components/ConfirmDialog/context'
import type { ConfirmOptions } from '@/components/ConfirmDialog/types'

const OPTIONS: ConfirmOptions = { title: 'Выйти?', message: 'Точно?', confirmLabel: 'Выйти', danger: true }

function Opener({ onResult, options = OPTIONS }: { onResult: (ok: boolean) => void; options?: ConfirmOptions }) {
  const confirm = useConfirm()
  return <button onClick={async () => onResult(await confirm(options))}>Открыть</button>
}

function setup(options?: ConfirmOptions) {
  const onResult = vi.fn()
  const user = userEvent.setup()
  render(
    <ConfirmProvider>
      <Opener onResult={onResult} options={options} />
    </ConfirmProvider>,
  )
  return { onResult, user }
}

describe('ConfirmDialog', () => {
  it('окна нет, пока о нём не попросили', () => {
    setup()
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })

  it('показывает заголовок и пояснение, модальное, с фокусом на «Отмена»', async () => {
    const { user } = setup()
    await user.click(screen.getByRole('button', { name: 'Открыть' }))
    const dialog = screen.getByRole('alertdialog', { name: 'Выйти?' })
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(screen.getByText('Точно?')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Отмена' })).toHaveFocus()
  })

  it('подтверждение возвращает true и закрывает окно, фокус возвращается на кнопку', async () => {
    const { onResult, user } = setup()
    const opener = screen.getByRole('button', { name: 'Открыть' })
    await user.click(opener)
    await user.click(screen.getByRole('button', { name: 'Выйти' }))
    await waitFor(() => expect(onResult).toHaveBeenCalledWith(true))
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(opener).toHaveFocus()
  })

  it('«Отмена» возвращает false', async () => {
    const { onResult, user } = setup()
    await user.click(screen.getByRole('button', { name: 'Открыть' }))
    await user.click(screen.getByRole('button', { name: 'Отмена' }))
    await waitFor(() => expect(onResult).toHaveBeenCalledWith(false))
  })

  it('Escape отменяет', async () => {
    const { onResult, user } = setup()
    await user.click(screen.getByRole('button', { name: 'Открыть' }))
    await user.keyboard('{Escape}')
    await waitFor(() => expect(onResult).toHaveBeenCalledWith(false))
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })

  it('свои подписи кнопки отмены', async () => {
    const { user } = setup({ title: 'Отменить?', confirmLabel: 'Да', cancelLabel: 'Продолжить' })
    await user.click(screen.getByRole('button', { name: 'Открыть' }))
    expect(screen.getByRole('button', { name: 'Продолжить' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Отмена' })).not.toBeInTheDocument()
  })

  it('Tab не уходит за пределы окна', async () => {
    const { user } = setup()
    await user.click(screen.getByRole('button', { name: 'Открыть' }))
    await user.tab()
    expect(screen.getByRole('button', { name: 'Выйти' })).toHaveFocus()
    await user.tab()
    expect(screen.getByRole('button', { name: 'Отмена' })).toHaveFocus()
    await user.tab({ shift: true })
    expect(screen.getByRole('button', { name: 'Выйти' })).toHaveFocus()
  })

  it('пока окно открыто, страница не прокручивается', async () => {
    const { user } = setup()
    await user.click(screen.getByRole('button', { name: 'Открыть' }))
    expect(document.body.style.overflow).toBe('hidden')
    await user.click(screen.getByRole('button', { name: 'Отмена' }))
    expect(document.body.style.overflow).toBe('')
  })

  it('без провайдера хук сообщает об ошибке настройки', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<Opener onResult={() => {}} />)).toThrow(/ConfirmProvider/)
    spy.mockRestore()
  })
})
