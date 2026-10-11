import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { UpdateBanner } from '@/components/UpdateBanner'

// подставной navigator.serviceWorker: событие смены управляющего worker и регистрация с update()
class FakeServiceWorker extends EventTarget {
  controller: object | null
  update = vi.fn().mockResolvedValue(undefined)
  constructor(controller: object | null) {
    super()
    this.controller = controller
  }
  getRegistration = () => Promise.resolve({ update: this.update })
  changeController() {
    this.dispatchEvent(new Event('controllerchange'))
  }
}

function install(controller: object | null) {
  const sw = new FakeServiceWorker(controller)
  Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: sw })
  return sw
}

beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }))
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('UpdateBanner', () => {
  it('сразу после открытия плашки нет', () => {
    install({})
    render(<UpdateBanner />)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('когда worker заменили на свежий, показывает плашку с кнопкой «Обновить»', () => {
    const sw = install({})
    render(<UpdateBanner />)
    act(() => sw.changeController())
    expect(screen.getByRole('status')).toHaveTextContent('Доступна новая версия')
    expect(screen.getByRole('button', { name: 'Обновить' })).toBeInTheDocument()
  })

  it('первая установка (worker раньше не управлял страницей) обновлением не считается', () => {
    const sw = install(null)
    render(<UpdateBanner />)
    act(() => sw.changeController())
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('«Обновить» перезагружает страницу', async () => {
    const reload = vi.fn()
    vi.stubGlobal('location', { ...window.location, reload })
    const sw = install({})
    render(<UpdateBanner />)
    act(() => sw.changeController())
    await userEvent.click(screen.getByRole('button', { name: 'Обновить' }))
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('«Позже» скрывает плашку, а следующее обновление показывает её снова', async () => {
    const sw = install({})
    render(<UpdateBanner />)
    act(() => sw.changeController())
    await userEvent.click(screen.getByRole('button', { name: 'Напомнить позже' }))
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    act(() => sw.changeController())
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('ищет обновление при возврате на вкладку и по таймеру', async () => {
    const sw = install({})
    render(<UpdateBanner />)
    const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible')
    document.dispatchEvent(new Event('visibilitychange'))
    await vi.waitFor(() => expect(sw.update).toHaveBeenCalledTimes(1))

    await act(async () => void vi.advanceTimersByTime(30 * 60 * 1000))
    await vi.waitFor(() => expect(sw.update).toHaveBeenCalledTimes(2))

    // скрытая вкладка не проверяет
    visibility.mockReturnValue('hidden')
    document.dispatchEvent(new Event('visibilitychange'))
    expect(sw.update).toHaveBeenCalledTimes(2)
  })

  it('без поддержки service worker ничего не делает', () => {
    Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: undefined })
    expect(() => render(<UpdateBanner />)).not.toThrow()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })
})
