import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Provider } from 'react-redux'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as api from '@/api'
import type { CoinEntry, Goal, Member } from '@/api'
import { IdentityContext } from '@/identity/context'
import Coins from '@/pages/Coins'
import { ProfileContext } from '@/profile/context'
import { makeStore } from '@/store'
import { ownerChanged } from '@/store/cache'
import { coinsApi, useGetCoinBalanceQuery } from '@/store/coins'
import { useGetGoalQuery, usePurchaseGoalMutation } from '@/store/goals'
import { saveCache } from '@/store/persist'
import { profileApi, useGetMeQuery, useSetMoodMutation, useUpdateProfileMutation } from '@/store/profile'
import { setSession } from '@/store/session'

vi.mock('@/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/api')>()),
  listCoinHistory: vi.fn(),
  getCoinBalance: vi.fn(),
  getGoal: vi.fn(),
  purchaseGoal: vi.fn(),
  updateProfile: vi.fn(),
  setMood: vi.fn(),
}))

const kid: Member = { id: 'kid', name: 'Миша', role: 'child', avatar: null, isOwner: false }
const goal = (over: Partial<Goal> = {}): Goal => ({ id: 'g1', memberId: 'kid', title: 'Лего', price: 300, url: null, image: null, createdAt: '2026-10-01T10:00:00Z', purchasedAt: null, ...over })
const entry = (n: number): CoinEntry => ({ id: `e${n}`, amount: 10, reason: `за дело ${n}`, createdAt: '2026-10-11T10:00:00Z', createdBy: null })

beforeEach(() => {
  localStorage.clear()
  setSession({ token: 'tok', memberId: 'kid' })
  vi.mocked(api.listCoinHistory).mockReset()
  vi.mocked(api.getCoinBalance).mockReset().mockResolvedValue(500)
  vi.mocked(api.getGoal).mockReset().mockResolvedValue({ goal: goal(), balance: 500 })
  vi.mocked(api.purchaseGoal).mockReset()
  vi.mocked(api.updateProfile).mockReset().mockResolvedValue({ member: { ...kid, email: 'x@y.z' } })
  vi.mocked(api.setMood).mockReset().mockResolvedValue({ mood: { value: 5, at: '' } })
})

describe('история монет из кэша', () => {
  it('после перезапуска записи и баланс видны на первом кадре, свежая страница приходит следом', async () => {
    vi.mocked(api.listCoinHistory).mockResolvedValue({ balance: 70, hasMore: false, items: [entry(1)] })
    const old = makeStore({ hydrate: false })
    const sub = old.dispatch(coinsApi.endpoints.getCoinHistory.initiate(''))
    await sub
    old.dispatch(ownerChanged('kid'))
    const state = old.getState().api
    const key = Object.keys(state.queries)[0]
    saveCache('kid', { queries: { [key]: { ...state.queries[key], fulfilledTimeStamp: Date.now() - 120_000 } }, provided: state.provided })
    sub.unsubscribe()

    let finish!: () => void
    vi.mocked(api.listCoinHistory).mockImplementation(() => new Promise((resolve) => (finish = () => resolve({ balance: 95, hasMore: false, items: [entry(2), entry(1)] }))))
    const identity = { familyCode: 'c', memberId: 'kid', name: 'Миша', role: 'child' as const, token: 'tok' }
    render(
      <Provider store={makeStore()}>
        <IdentityContext.Provider value={{ identity, save: async () => {}, clear: async () => {} }}>
          <ProfileContext.Provider value={{ data: { me: { ...kid, email: 'x@y.z', coins: 70 }, members: [kid] }, failed: false }}>
            <MemoryRouter initialEntries={['/coins']}>
              <Routes><Route path="/coins" element={<Coins />} /></Routes>
            </MemoryRouter>
          </ProfileContext.Provider>
        </IdentityContext.Provider>
      </Provider>,
    )
    // сразу: сохранённые записи (без «Загрузка…»), хотя запрос ещё не завершился
    expect(screen.getByText('за дело 1')).toBeInTheDocument()
    expect(screen.queryByText('Загрузка…')).not.toBeInTheDocument()
    finish()
    await screen.findByText('за дело 2')
    expect(screen.getByText('95')).toBeInTheDocument()
  })
})

describe('покупка цели', () => {
  function Probe() {
    const { data } = useGetGoalQuery('g1')
    const balance = useGetCoinBalanceQuery('kid')
    const [purchase] = usePurchaseGoalMutation()
    return (
      <div>
        <p data-testid="bought">{data?.goal.purchasedAt ? 'куплено' : 'нет'}</p>
        <p data-testid="card-balance">{data?.balance}</p>
        <p data-testid="balance">{balance.data}</p>
        <button onClick={() => void purchase('g1')}>buy</button>
      </div>
    )
  }

  it('ответ сервера сразу попадает в карточку, баланс монет запрашивается заново', async () => {
    let finishRefetch!: () => void
    vi.mocked(api.purchaseGoal).mockImplementation(async () => {
      // повторный запрос карточки ещё в пути: на экране уже ответ покупки
      vi.mocked(api.getGoal).mockImplementation(() => new Promise((resolve) => (finishRefetch = () => resolve({ goal: goal({ purchasedAt: 'x' }), balance: 200 }))))
      return { goal: goal({ purchasedAt: '2026-10-12T10:00:00Z' }), balance: 200 }
    })
    render(<Provider store={makeStore({ hydrate: false })}><Probe /></Provider>)
    await waitFor(() => expect(screen.getByTestId('balance')).toHaveTextContent('500'))
    vi.mocked(api.getCoinBalance).mockResolvedValue(200)
    await userEvent.click(screen.getByText('buy'))
    await waitFor(() => expect(screen.getByTestId('bought')).toHaveTextContent('куплено'))
    expect(screen.getByTestId('card-balance')).toHaveTextContent('200')
    await waitFor(() => expect(screen.getByTestId('balance')).toHaveTextContent('200'))
    act(() => finishRefetch())
  })
})

describe('профиль: изменения видны сразу', () => {
  const overview = () => ({ member: { ...kid, email: 'x@y.z', coins: 5 }, family: { code: 'c' }, members: [kid] })

  function Probe() {
    const { data } = useGetMeQuery()
    const [setMood] = useSetMoodMutation()
    const [updateProfile] = useUpdateProfileMutation()
    return (
      <div>
        <p data-testid="mood">{data?.me.mood?.value ?? '-'}</p>
        <p data-testid="name">{data?.me.name}</p>
        <p data-testid="member-name">{data?.members[0]?.name}</p>
        <button onClick={() => void setMood(4)}>mood</button>
        <button onClick={() => void updateProfile({ name: 'Михаил' })}>rename</button>
      </div>
    )
  }

  // профиль приходит обычным запросом (путь /me), его подменяем на уровне fetch
  beforeEach(() => {
    vi.stubGlobal('fetch', async () => new Response(JSON.stringify(overview()), { status: 200 }))
  })
  afterEach(() => vi.unstubAllGlobals())

  it('настроение появляется до ответа сервера', async () => {
    let finish!: () => void
    vi.mocked(api.setMood).mockImplementation(() => new Promise((resolve) => (finish = () => resolve({ mood: { value: 4, at: '' } }))))
    render(<Provider store={makeStore({ hydrate: false })}><Probe /></Provider>)
    await waitFor(() => expect(screen.getByTestId('name')).toHaveTextContent('Миша'))
    await userEvent.click(screen.getByText('mood'))
    expect(screen.getByTestId('mood')).toHaveTextContent('4')
    act(() => finish())
  })

  it('имя меняется и в «я», и в списке семьи сразу; при ошибке возвращается прежнее', async () => {
    vi.mocked(api.updateProfile).mockRejectedValueOnce(new api.ApiError(409, 'name_taken'))
    const store = makeStore({ hydrate: false })
    render(<Provider store={store}><Probe /></Provider>)
    await waitFor(() => expect(screen.getByTestId('name')).toHaveTextContent('Миша'))
    await userEvent.click(screen.getByText('rename'))
    await waitFor(() => expect(screen.getByTestId('name')).toHaveTextContent('Миша'))
    expect(screen.getByTestId('member-name')).toHaveTextContent('Миша')

    let finish!: () => void
    vi.mocked(api.updateProfile).mockImplementation(() => new Promise((resolve) => (finish = () => resolve({ member: { ...kid, email: 'x@y.z' } }))))
    await userEvent.click(screen.getByText('rename'))
    expect(screen.getByTestId('name')).toHaveTextContent('Михаил')
    expect(screen.getByTestId('member-name')).toHaveTextContent('Михаил')
    expect(profileApi.endpoints.getMe.select()(store.getState()).data?.me.name).toBe('Михаил')
    act(() => finish())
  })
})
