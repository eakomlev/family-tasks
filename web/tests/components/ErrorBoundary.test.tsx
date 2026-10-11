import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { resetApp } from '@/lib/resetApp'

function Boom(): never {
  throw new Error('сломалось при отрисовке')
}

afterEach(() => vi.unstubAllGlobals())

describe('ErrorBoundary', () => {
  it('без ошибок показывает содержимое', () => {
    render(<ErrorBoundary><p>всё хорошо</p></ErrorBoundary>)
    expect(screen.getByText('всё хорошо')).toBeInTheDocument()
  })

  it('при ошибке отрисовки вместо белого экрана показывает причину и кнопку сброса', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(<ErrorBoundary><Boom /></ErrorBoundary>)
    expect(screen.getByRole('alert')).toHaveTextContent('Что-то пошло не так')
    expect(screen.getByText('сломалось при отрисовке')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Сбросить и перезагрузить' })).toBeInTheDocument()
    spy.mockRestore()
  })
})

describe('resetApp', () => {
  it('отключает service worker, чистит кэши и перезагружает страницу', async () => {
    const unregister = vi.fn().mockResolvedValue(true)
    const remove = vi.fn().mockResolvedValue(true)
    const reload = vi.fn()
    vi.stubGlobal('caches', { keys: async () => ['workbox-precache', 'другой'], delete: remove })
    Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: { getRegistrations: async () => [{ unregister }, { unregister }] } })
    vi.stubGlobal('location', { ...window.location, reload })

    await resetApp()

    expect(unregister).toHaveBeenCalledTimes(2)
    expect(remove).toHaveBeenCalledWith('workbox-precache')
    expect(remove).toHaveBeenCalledWith('другой')
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('перезагружает страницу, даже если очистка не удалась', async () => {
    const reload = vi.fn()
    Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: { getRegistrations: async () => { throw new Error('нет доступа') } } })
    vi.stubGlobal('location', { ...window.location, reload })
    await resetApp()
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('кнопка в окне ошибки запускает сброс', async () => {
    const reload = vi.fn()
    Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: { getRegistrations: async () => [] } })
    vi.stubGlobal('location', { ...window.location, reload })
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(<ErrorBoundary><Boom /></ErrorBoundary>)
    await userEvent.click(screen.getByRole('button', { name: 'Сбросить и перезагрузить' }))
    await waitFor(() => expect(reload).toHaveBeenCalled())
    spy.mockRestore()
  })
})
