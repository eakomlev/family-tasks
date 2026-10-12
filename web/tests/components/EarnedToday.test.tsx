import { act, render, screen } from '@testing-library/react'
import { Provider } from 'react-redux'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as api from '@/api'
import { IdentityContext } from '@/identity/context'
import type { Identity } from '@/identity/types'
import { EarnedToday } from '@/pages/MyDay/components/EarnedToday'
import { startOfDayIso } from '@/pages/MyDay/utils'
import { RealtimeContext } from '@/realtime/context'
import type { Listener } from '@/realtime/types'
import { makeStore } from '@/store'
import { RealtimeBridge } from '@/store/RealtimeBridge'
import { setSession } from '@/store/session'

vi.mock('@/api', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/api')>()), getCoinsEarned: vi.fn() }))

// 11 октября 2026, 15:00 (часовой пояс тестов Москва)
const NOW = new Date(2026, 9, 11, 15, 0)

function renderBanner(role: Identity['role'] = 'child', listeners = new Set<Listener>()) {
  const identity: Identity = { familyCode: 'c', memberId: 'kid', name: 'Миша', role, token: 'tok' }
  render(
    <Provider store={makeStore({ hydrate: false })}>
      <RealtimeContext.Provider value={{ subscribe: (l) => (listeners.add(l), () => void listeners.delete(l)), setViewing: () => {} }}>
        <RealtimeBridge />
        <IdentityContext.Provider value={{ identity, save: async () => {}, clear: async () => {} }}>
          <MemoryRouter><EarnedToday now={NOW} /></MemoryRouter>
        </IdentityContext.Provider>
      </RealtimeContext.Provider>
    </Provider>,
  )
  return listeners
}

beforeEach(() => {
  setSession({ token: 'tok', memberId: 'kid' })
  vi.mocked(api.getCoinsEarned).mockReset()
})

describe('startOfDayIso', () => {
  it('полночь местного дня в ISO (UTC)', () => {
    expect(startOfDayIso(new Date(2026, 9, 11, 15, 0))).toBe('2026-10-10T21:00:00.000Z')
    expect(startOfDayIso(new Date(2026, 9, 11, 0, 0))).toBe('2026-10-10T21:00:00.000Z')
    expect(startOfDayIso(new Date(2026, 9, 11, 23, 59))).toBe('2026-10-10T21:00:00.000Z')
  })
})

describe('сколько заработано сегодня', () => {
  it('больше нуля: плашка со ссылкой на историю', async () => {
    vi.mocked(api.getCoinsEarned).mockResolvedValue({ earned: 45 })
    renderBanner()
    const link = await screen.findByRole('link', { name: /Сегодня заработано: 45 монет/ })
    expect(link).toHaveAttribute('href', '/coins')
    expect(link).toHaveTextContent('+45 монет')
    // считаем с начала местного дня
    expect(api.getCoinsEarned).toHaveBeenCalledWith('tok', '2026-10-10T21:00:00.000Z')
  })

  it('склонение: 1 монета, 2 монеты, 5 монет', async () => {
    vi.mocked(api.getCoinsEarned).mockResolvedValue({ earned: 1 })
    renderBanner()
    expect(await screen.findByText('+1 монета')).toBeInTheDocument()
  })

  it('ноль: плашки нет', async () => {
    vi.mocked(api.getCoinsEarned).mockResolvedValue({ earned: 0 })
    renderBanner()
    await vi.waitFor(() => expect(api.getCoinsEarned).toHaveBeenCalled())
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })

  it('ошибка запроса: плашки нет, страница не ломается', async () => {
    vi.mocked(api.getCoinsEarned).mockRejectedValue(new api.ApiError(0, 'network'))
    renderBanner()
    await vi.waitFor(() => expect(api.getCoinsEarned).toHaveBeenCalled())
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })

  it('у родителя запроса и плашки нет', () => {
    renderBanner('mama')
    expect(api.getCoinsEarned).not.toHaveBeenCalled()
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })

  it('начислили монеты (сигнал сокета): сумма пересчитывается и плашка появляется без перезагрузки', async () => {
    vi.mocked(api.getCoinsEarned).mockResolvedValueOnce({ earned: 0 }).mockResolvedValueOnce({ earned: 20 })
    const listeners = renderBanner()
    await vi.waitFor(() => expect(api.getCoinsEarned).toHaveBeenCalledTimes(1))
    expect(screen.queryByRole('link')).not.toBeInTheDocument()

    act(() => listeners.forEach((l) => l({ type: 'members' })))
    expect(await screen.findByText('+20 монет')).toBeInTheDocument()
  })

  it('монеты забрали (отмена награды): плашка исчезает', async () => {
    vi.mocked(api.getCoinsEarned).mockResolvedValueOnce({ earned: 20 }).mockResolvedValueOnce({ earned: 0 })
    const listeners = renderBanner()
    await screen.findByText('+20 монет')
    act(() => listeners.forEach((l) => l({ type: 'members' })))
    await vi.waitFor(() => expect(screen.queryByRole('link')).not.toBeInTheDocument())
  })
})
