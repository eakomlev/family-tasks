import { act, render, screen, waitFor, within } from '@testing-library/react'
import { Provider } from 'react-redux'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { makeStore } from '@/store'
import { RealtimeBridge } from '@/store/RealtimeBridge'
import { setSession } from '@/store/session'
import * as api from '@/api'
import type { CoinEntry, Member } from '@/api'
import { IdentityContext } from '@/identity/context'
import type { Identity } from '@/identity/types'
import Coins from '@/pages/Coins'
import { ProfileContext } from '@/profile/context'
import { RealtimeContext } from '@/realtime/context'
import type { Listener } from '@/realtime/types'

vi.mock('@/api', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/api')>()), listCoinHistory: vi.fn(), listGoals: vi.fn(async () => ({ goals: [] })) }))

const members: Member[] = [
  { id: 'mama', name: 'Лена', role: 'mama', avatar: null, isOwner: true },
  { id: 'kid', name: 'Миша', role: 'child', avatar: null, isOwner: false },
]

const entry = (n: number, over: Partial<CoinEntry> = {}): CoinEntry => ({
  id: `e${n}`,
  amount: 10,
  reason: `за дело ${n}`,
  createdAt: '2026-10-11T10:00:00Z',
  createdBy: 'mama',
  ...over,
})

// перехватываем IntersectionObserver, чтобы «прокрутить» вручную
let observers: { callback: IntersectionObserverCallback; observed: Element[]; disconnected: boolean }[] = []
class FakeObserver {
  entry!: (typeof observers)[number]
  constructor(callback: IntersectionObserverCallback) {
    this.entry = { callback, observed: [], disconnected: false }
    observers.push(this.entry)
  }
  observe(el: Element) {
    this.entry.observed.push(el)
  }
  disconnect() {
    this.entry.disconnected = true
  }
  unobserve() {}
  takeRecords() {
    return []
  }
}
// Сторож в конце списка появляется в эффекте уже после показа записей, а после каждой подгрузки старый сторож отключается и создаётся новый:
// «прокручивать» можно только когда живой сторож есть, иначе тест случайно не прокручивает ничего
const observerReady = () => waitFor(() => expect(observers.some((o) => !o.disconnected && o.observed.length > 0)).toBe(true))
const scrollToEnd = () => {
  const live = observers.filter((o) => !o.disconnected)
  act(() => live.forEach((o) => o.callback([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver)))
}

function renderPage(role: 'child' | 'mama' = 'child', listeners = new Set<Listener>(), path = '/coins') {
  const me = role === 'child' ? members[1] : members[0]
  const identity: Identity = { familyCode: 'c', memberId: me.id, name: me.name, role, token: 'tok' }
  render(
    <Provider store={makeStore({ hydrate: false })}>
    <RealtimeContext.Provider value={{ subscribe: (l) => (listeners.add(l), () => void listeners.delete(l)), setViewing: () => {} }}>
      <RealtimeBridge />
      <IdentityContext.Provider value={{ identity, save: async () => {}, clear: async () => {} }}>
        <ProfileContext.Provider value={{ data: { me: { ...me, email: 'x@y.z', coins: 70 }, members }, failed: false }}>
          <MemoryRouter initialEntries={[path]}>
            <Routes>
              <Route path="/coins" element={<Coins />} />
              <Route path="/coins/:memberId" element={<Coins />} />
              <Route path="/family/:memberId" element={<p>Страница ребёнка</p>} />
              <Route path="/my-day" element={<p>Мой день</p>} />
            </Routes>
          </MemoryRouter>
        </ProfileContext.Provider>
      </IdentityContext.Provider>
    </RealtimeContext.Provider>
    </Provider>,
  )
  return listeners
}

beforeEach(() => {
  setSession({ token: 'tok', memberId: 'x' })
  observers = []
  vi.stubGlobal('IntersectionObserver', FakeObserver)
  vi.mocked(api.listCoinHistory).mockReset()
})
afterEach(() => vi.unstubAllGlobals())

describe('страница истории монет', () => {
  it('баланс и записи: за что, когда, кем и сколько', async () => {
    vi.mocked(api.listCoinHistory).mockResolvedValue({
      balance: 70,
      hasMore: false,
      items: [
        entry(1, { amount: 50, reason: 'Помыл посуду' }),
        entry(2, { amount: -20, reason: 'Мороженое', createdBy: null }),
        entry(3, { amount: 40, reason: '' }),
      ],
    })
    renderPage()
    const rows = await screen.findAllByRole('listitem')
    expect(rows).toHaveLength(3)
    expect(within(rows[0]).getByText('Помыл посуду')).toBeInTheDocument()
    expect(within(rows[0]).getByText('+50')).toBeInTheDocument()
    expect(within(rows[0]).getByText('11 октября, 13:00 · Мама')).toBeInTheDocument()
    expect(within(rows[1]).getByText('−20')).toBeInTheDocument()
    expect(within(rows[1]).getByText(/Система/)).toBeInTheDocument()
    expect(within(rows[2]).getByText('Без описания')).toBeInTheDocument()
    expect(screen.getByText('70')).toBeInTheDocument()
    expect(api.listCoinHistory).toHaveBeenCalledWith('tok', undefined, undefined)
  })

  it('пустая история: подсказка', async () => {
    vi.mocked(api.listCoinHistory).mockResolvedValue({ balance: 0, hasMore: false, items: [] })
    renderPage()
    expect(await screen.findByText('Пока нет ни одного начисления.')).toBeInTheDocument()
  })

  it('прокрутка к концу подгружает следующую страницу, без дублей; в конце сторожа нет', async () => {
    vi.mocked(api.listCoinHistory)
      .mockResolvedValueOnce({ balance: 70, hasMore: true, items: [entry(1), entry(2)] })
      .mockResolvedValueOnce({ balance: 70, hasMore: true, items: [entry(2), entry(3), entry(4)] })
      .mockResolvedValueOnce({ balance: 70, hasMore: false, items: [entry(5)] })
    renderPage()
    await screen.findByText('за дело 2')
    expect(screen.getAllByRole('listitem')).toHaveLength(2)

    await observerReady()
    scrollToEnd()
    await waitFor(() => expect(screen.getAllByRole('listitem')).toHaveLength(4))
    // следующий запрос просит записи старше самой старой из загруженных
    expect(api.listCoinHistory).toHaveBeenLastCalledWith('tok', 'e2', undefined)

    await observerReady()
    scrollToEnd()
    await waitFor(() => expect(screen.getAllByRole('listitem')).toHaveLength(5))
    expect(api.listCoinHistory).toHaveBeenLastCalledWith('tok', 'e4', undefined)
    expect(screen.queryByRole('button', { name: /Показать ещё/ })).not.toBeInTheDocument()
    expect(screen.getAllByRole('listitem').map((li) => li.textContent).join()).not.toMatch(/за дело 2.*за дело 2/)
  })

  it('пока идёт загрузка страницы, повторные срабатывания не дублируют запрос', async () => {
    let finish!: (v: Awaited<ReturnType<typeof api.listCoinHistory>>) => void
    vi.mocked(api.listCoinHistory)
      .mockResolvedValueOnce({ balance: 70, hasMore: true, items: [entry(1)] })
      .mockReturnValueOnce(new Promise((resolve) => (finish = resolve)))
    renderPage()
    await screen.findByText('за дело 1')
    await observerReady()
    scrollToEnd()
    scrollToEnd()
    scrollToEnd()
    expect(api.listCoinHistory).toHaveBeenCalledTimes(2)
    await act(async () => finish({ balance: 70, hasMore: false, items: [entry(2)] }))
    await screen.findByText('за дело 2')
  })

  it('кнопка «Показать ещё» подгружает вручную', async () => {
    vi.mocked(api.listCoinHistory)
      .mockResolvedValueOnce({ balance: 70, hasMore: true, items: [entry(1)] })
      .mockResolvedValueOnce({ balance: 70, hasMore: false, items: [entry(2)] })
    renderPage()
    await userEvent.click(await screen.findByRole('button', { name: 'Показать ещё' }))
    expect(await screen.findByText('за дело 2')).toBeInTheDocument()
  })

  it('ошибка подгрузки: записи остаются, можно повторить', async () => {
    vi.mocked(api.listCoinHistory)
      .mockResolvedValueOnce({ balance: 70, hasMore: true, items: [entry(1)] })
      .mockRejectedValueOnce(new api.ApiError(500, 'internal_error'))
      .mockResolvedValueOnce({ balance: 70, hasMore: false, items: [entry(2)] })
    renderPage()
    await screen.findByText('за дело 1')
    await observerReady()
    scrollToEnd()
    expect(await screen.findByText(/Не удалось загрузить ещё/)).toBeInTheDocument()
    expect(screen.getByText('за дело 1')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Повторить' }))
    expect(await screen.findByText('за дело 2')).toBeInTheDocument()
  })

  it('ошибка первой загрузки', async () => {
    vi.mocked(api.listCoinHistory).mockRejectedValue(new api.ApiError(500, 'x'))
    renderPage()
    expect(await screen.findByText(/Не удалось загрузить историю/)).toBeInTheDocument()
  })

  it('новое начисление по сигналу сокета встаёт сверху, подгруженные старые остаются', async () => {
    vi.mocked(api.listCoinHistory)
      .mockResolvedValueOnce({ balance: 70, hasMore: false, items: [entry(2), entry(3)] })
      .mockResolvedValueOnce({ balance: 95, hasMore: false, items: [entry(1, { amount: 25, reason: 'Новое' }), entry(2)] })
    const listeners = renderPage()
    await screen.findByText('за дело 3')
    act(() => listeners.forEach((l) => l({ type: 'members' })))
    await screen.findByText('Новое')
    const reasons = screen.getAllByRole('listitem').map((li) => li.textContent ?? '')
    expect(reasons[0]).toContain('Новое')
    expect(reasons).toHaveLength(3)
    expect(screen.getByText('95')).toBeInTheDocument()
  })

  it('родителя со страницы монет возвращает на стартовую', () => {
    renderPage('mama')
    expect(screen.getByText('Мой день')).toBeInTheDocument()
    expect(api.listCoinHistory).not.toHaveBeenCalled()
  })

  describe('родитель смотрит монеты ребёнка', () => {
    it('грузит историю этого ребёнка, заголовок с именем, назад на его страницу', async () => {
      vi.mocked(api.listCoinHistory).mockResolvedValue({ items: [entry(1)], hasMore: false, balance: 30 })
      renderPage('mama', new Set(), '/coins/kid')
      expect(await screen.findByRole('heading', { name: 'Монеты: Миша' })).toBeInTheDocument()
      expect(api.listCoinHistory).toHaveBeenCalledWith('tok', undefined, 'kid')
      expect(await screen.findByText('30')).toBeInTheDocument()
      expect(screen.getByRole('link', { name: 'Назад' })).toHaveAttribute('href', '/family/kid')
    })

    it('без выбранного ребёнка родителя уводит на стартовую страницу', () => {
      renderPage('mama')
      expect(screen.getByText('Мой день')).toBeInTheDocument()
      expect(api.listCoinHistory).not.toHaveBeenCalled()
    })
  })
})
