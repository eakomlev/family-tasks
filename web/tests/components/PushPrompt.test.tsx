import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { IdentityContext } from '@/identity/context'
import { PushPrompt } from '@/components/PushPrompt'
import { DISMISS_FOR_MS, isDismissed, rememberDismissed } from '@/components/PushPrompt/utils'
import { UpdateBanner } from '@/components/UpdateBanner'
import type { PushStatus } from '@/lib/usePushSubscription'

const push = { status: 'off' as PushStatus, busy: false, error: undefined as string | undefined, enable: vi.fn(), disable: vi.fn() }
vi.mock('@/lib/usePushSubscription', () => ({ usePushSubscription: () => push }))

const update = { ready: true, dismiss: vi.fn(), reload: vi.fn() }
vi.mock('@/lib/useAppUpdate', () => ({ useAppUpdate: () => update }))

const identity = { familyCode: 'c', memberId: 'm1', name: 'Лена', role: 'mama' as const, token: 'tok' }
const renderPrompt = (withIdentity = true) =>
  render(
    <IdentityContext.Provider value={{ identity: withIdentity ? identity : null, save: async () => {}, clear: async () => {} }}>
      <PushPrompt />
    </IdentityContext.Provider>,
  )

beforeEach(() => {
  localStorage.clear()
  Object.assign(push, { status: 'off', busy: false, error: undefined })
  push.enable.mockReset().mockResolvedValue(undefined)
  update.dismiss.mockReset()
  update.reload.mockReset()
  document.documentElement.style.removeProperty('--update-banner-bottom')
})

describe('PushPrompt: плашка про уведомления при запуске', () => {
  it('уведомления выключены: показывается плашка с кнопкой «Включить уведомления»', async () => {
    renderPrompt()
    expect(screen.getByText(/Включите уведомления/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Включить уведомления' }))
    expect(push.enable).toHaveBeenCalledTimes(1)
  })

  it('включены, запрещены, браузер не умеет, ещё проверяется или нет входа: плашки нет', () => {
    for (const status of ['on', 'denied', 'unsupported', 'no-worker', 'loading'] as PushStatus[]) {
      push.status = status
      const { container, unmount } = renderPrompt()
      expect(container).toBeEmptyDOMElement()
      unmount()
    }
    push.status = 'off'
    expect(renderPrompt(false).container).toBeEmptyDOMElement()
  })

  it('«Позже» прячет плашку и запоминает это на неделю', async () => {
    const { container, unmount } = renderPrompt()
    await userEvent.click(screen.getByRole('button', { name: 'Позже' }))
    expect(container).toBeEmptyDOMElement()
    unmount()
    // при следующем запуске плашки нет
    expect(renderPrompt().container).toBeEmptyDOMElement()
  })

  it('ошибка включения видна в плашке; пока идёт запрос, кнопка недоступна', () => {
    push.busy = true
    push.error = 'Не удалось включить уведомления. Попробуйте ещё раз.'
    renderPrompt()
    expect(screen.getByText(/Не удалось включить/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Подождите…' })).toBeDisabled()
  })
})

describe('срок скрытия плашки', () => {
  it('сутки назад скрыта, через неделю возвращается', () => {
    const now = Date.now()
    expect(isDismissed(now)).toBe(false)
    rememberDismissed(now - 24 * 60 * 60 * 1000)
    expect(isDismissed(now)).toBe(true)
    rememberDismissed(now - DISMISS_FOR_MS - 1000)
    expect(isDismissed(now)).toBe(false)
  })
})

describe('UpdateBanner: заметная плашка обновления', () => {
  it('показывает «Обновить» и «Позже»', async () => {
    render(<UpdateBanner />)
    expect(screen.getByRole('status')).toHaveTextContent('Доступна новая версия приложения')
    await userEvent.click(screen.getByRole('button', { name: 'Обновить' }))
    expect(update.reload).toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: 'Напомнить позже' }))
    expect(update.dismiss).toHaveBeenCalled()
  })

  it('пока плашка видна, её нижний край публикуется для других плашек; после закрытия убирается', () => {
    const { rerender } = render(<UpdateBanner />)
    expect(document.documentElement.style.getPropertyValue('--update-banner-bottom')).toMatch(/px$/)
    update.ready = false
    act(() => rerender(<UpdateBanner />))
    expect(document.documentElement.style.getPropertyValue('--update-banner-bottom')).toBe('')
    update.ready = true
  })
})
