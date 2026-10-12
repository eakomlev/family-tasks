import { act, render, screen, waitFor } from '@testing-library/react'
import { Provider } from 'react-redux'
import { MemoryRouter, useNavigate } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Identity } from '@/identity/types'
import { IdentityContext } from '@/identity/context'
import { ProfileProvider } from '@/profile'
import { useProfile } from '@/profile/context'
import { RealtimeContext } from '@/realtime/context'
import type { Listener } from '@/realtime/types'
import { makeStore } from '@/store'
import { ownerChanged } from '@/store/cache'
import { saveCache } from '@/store/persist'
import { profileApi } from '@/store/profile'
import { RealtimeBridge } from '@/store/RealtimeBridge'
import { setSession } from '@/store/session'

const mama = { id: 'mama', name: 'Лена', role: 'mama' as const, avatar: null, isOwner: true }
const overview = (name = 'Лена') => ({ member: { ...mama, name, email: 'l@x.y' }, family: { code: 'c' }, members: [{ ...mama, name }] })
const identity: Identity = { familyCode: 'c', memberId: 'mama', name: 'Лена', role: 'mama', token: 'tok' }

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

function Probe() {
  const { data, failed } = useProfile()
  const navigate = useNavigate()
  return (
    <div>
      <p data-testid="name">{data?.me.name ?? 'нет данных'}</p>
      <p data-testid="failed">{String(failed)}</p>
      <button onClick={() => navigate('/other')}>go</button>
    </div>
  )
}

function renderProvider(store: ReturnType<typeof makeStore>, clear = vi.fn().mockResolvedValue(undefined), listeners = new Set<Listener>()) {
  return {
    clear,
    listeners,
    ...render(
      <Provider store={store}>
        <IdentityContext.Provider value={{ identity, save: async () => {}, clear }}>
          <RealtimeContext.Provider value={{ subscribe: (l) => (listeners.add(l), () => void listeners.delete(l)), setViewing: () => {} }}>
            <MemoryRouter>
              <RealtimeBridge />
              <ProfileProvider>
                <Probe />
              </ProfileProvider>
            </MemoryRouter>
          </RealtimeContext.Provider>
        </IdentityContext.Provider>
      </Provider>,
    ),
  }
}

beforeEach(() => {
  localStorage.clear()
  setSession({ token: 'tok', memberId: 'mama' })
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
  setSession(undefined)
})

describe('профиль из кэша RTK Query', () => {
  it('сохранённый профиль виден на первом кадре, пока свежий ещё грузится', async () => {
    // прошлый запуск: профиль загружен и сохранён
    vi.stubGlobal('fetch', vi.fn(async () => json(overview('Лена (из кэша)'))))
    const old = makeStore({ hydrate: false })
    const sub = old.dispatch(profileApi.endpoints.getMe.initiate())
    await sub
    old.dispatch(ownerChanged('mama'))
    saveCache('mama', old.getState().api)
    sub.unsubscribe()

    // новый запуск: запрос не завершается
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>(() => {})))
    renderProvider(makeStore())
    expect(screen.getByTestId('name')).toHaveTextContent('Лена (из кэша)')
  })

  it('свежий профиль приходит следом и заменяет сохранённый', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json(overview('Лена'))))
    const old = makeStore({ hydrate: false })
    const sub = old.dispatch(profileApi.endpoints.getMe.initiate())
    await sub
    old.dispatch(ownerChanged('mama'))
    // состарим запись: иначе свежие (до 30 секунд) повторно не запрашиваются
    const state = old.getState().api
    const key = Object.keys(state.queries)[0]
    saveCache('mama', { queries: { [key]: { ...state.queries[key], fulfilledTimeStamp: Date.now() - 120_000 } }, provided: state.provided })
    sub.unsubscribe()

    vi.stubGlobal('fetch', vi.fn(async () => json(overview('Лена (новое имя)'))))
    renderProvider(makeStore())
    expect(screen.getByTestId('name')).toHaveTextContent('Лена')
    await waitFor(() => expect(screen.getByTestId('name')).toHaveTextContent('Лена (новое имя)'))
  })

  it('переход между экранами профиль не перезапрашивает (раньше запрашивал на каждом переходе)', async () => {
    const fetchMock = vi.fn(async () => json(overview()))
    vi.stubGlobal('fetch', fetchMock)
    renderProvider(makeStore({ hydrate: false }))
    await waitFor(() => expect(screen.getByTestId('name')).toHaveTextContent('Лена'))
    expect(fetchMock).toHaveBeenCalledTimes(1)
    for (let i = 0; i < 3; i++) await act(async () => screen.getByText('go').click())
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('сигнал members с сервера обновляет профиль (через инвалидацию кэша)', async () => {
    const fetchMock = vi.fn(async () => json(overview()))
    vi.stubGlobal('fetch', fetchMock)
    const { listeners } = renderProvider(makeStore({ hydrate: false }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    act(() => listeners.forEach((l) => l({ type: 'members' })))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
  })

  it('401: вход стирается; обрыв сети вход не трогает и показывает ошибку', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json({ error: 'unauthorized' }, 401)))
    const first = renderProvider(makeStore({ hydrate: false }))
    await waitFor(() => expect(first.clear).toHaveBeenCalled())
    first.unmount()

    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('network') }))
    const second = renderProvider(makeStore({ hydrate: false }))
    await waitFor(() => expect(screen.getByTestId('failed')).toHaveTextContent('true'))
    expect(second.clear).not.toHaveBeenCalled()
  })

  it('пока вход не прочитан, запрос не уходит и не выдаётся за 401', async () => {
    setSession(undefined)
    const fetchMock = vi.fn(async () => json(overview()))
    vi.stubGlobal('fetch', fetchMock)
    const view = renderProvider(makeStore({ hydrate: false }))
    await waitFor(() => expect(screen.getByTestId('failed')).toHaveTextContent('true'))
    expect(fetchMock).not.toHaveBeenCalled()
    expect(view.clear).not.toHaveBeenCalled()
  })
})
