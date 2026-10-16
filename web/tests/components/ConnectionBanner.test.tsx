import { act, cleanup, render, screen } from '@testing-library/react'
import { Provider } from 'react-redux'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ConnectionBanner } from '@/components/ConnectionBanner'
import { reportNetworkFailure, reportNetworkOk, resetConnection } from '@/lib/connection'
import { RETRY_DELAY_MS } from '@/lib/retry'
import { makeStore } from '@/store'

const fetchMock = vi.fn()

beforeEach(() => {
  vi.useFakeTimers()
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.unstubAllGlobals()
  resetConnection()
})

const renderBanner = () =>
  render(
    <Provider store={makeStore({ hydrate: false })}>
      <ConnectionBanner />
    </Provider>,
  )

describe('плашка «Соединение…»', () => {
  it('со связью её нет и запросов не идёт', () => {
    renderBanner()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('без связи показывается и проверяет связь каждые 2–3 секунды; когда сервер ответил, пропадает', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))
    renderBanner()
    act(() => reportNetworkFailure())
    expect(screen.getByRole('status')).toHaveTextContent('Соединение…')
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0][0]).toBe('/api/health')
    await act(async () => {
      await vi.advanceTimersByTimeAsync(RETRY_DELAY_MS)
    })
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(screen.getByRole('status')).toBeInTheDocument()

    // связь вернулась: очередная проверка прошла
    fetchMock.mockResolvedValue(new Response('{"ok":true}', { status: 200 }))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(RETRY_DELAY_MS)
    })
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    const calls = fetchMock.mock.calls.length
    await act(async () => {
      await vi.advanceTimersByTimeAsync(RETRY_DELAY_MS * 3)
    })
    // проверки прекратились
    expect(fetchMock).toHaveBeenCalledTimes(calls)
  })

  it('ответ сервера с ошибкой тоже значит, что связь есть', async () => {
    renderBanner()
    act(() => reportNetworkFailure())
    act(() => reportNetworkOk())
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })
})
