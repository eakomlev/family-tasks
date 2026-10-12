import { act, render } from '@testing-library/react'
import { Provider } from 'react-redux'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { IdentityContext } from '@/identity/context'
import type { Identity } from '@/identity/types'
import { RealtimeContext } from '@/realtime/context'
import type { Listener } from '@/realtime/types'
import { makeStore } from '@/store'
import { api } from '@/store/api'
import { RealtimeBridge } from '@/store/RealtimeBridge'
import { saveCache } from '@/store/persist'
import { SessionSync } from '@/store/SessionSync'
import { getSession, setSession } from '@/store/session'

const query = { status: 'fulfilled', endpointName: 'thing', fulfilledTimeStamp: Date.now(), data: { x: 1 } }
const identity = (memberId: string): Identity => ({ familyCode: 'c', memberId, name: 'Имя', role: 'mama', token: `tok-${memberId}` })

function renderSync(store: ReturnType<typeof makeStore>, who: Identity | null) {
  return render(
    <Provider store={store}>
      <IdentityContext.Provider value={{ identity: who, save: async () => {}, clear: async () => {} }}>
        <SessionSync />
      </IdentityContext.Provider>
    </Provider>,
  )
}

beforeEach(() => localStorage.clear())
afterEach(() => setSession(undefined))

describe('SessionSync: вход и кэш', () => {
  it('тот же пользователь: кэш остаётся, токен выставлен для запросов, запись разрешена', () => {
    saveCache('u1', { queries: { a: query } })
    const store = makeStore()
    expect(Object.keys(store.getState().api.queries)).toContain('a')
    renderSync(store, identity('u1'))
    expect(Object.keys(store.getState().api.queries)).toContain('a')
    expect(getSession()).toEqual({ token: 'tok-u1', memberId: 'u1' })
    expect(store.getState().cache.owner).toBe('u1')
    expect(localStorage.getItem('family-tasks:cache:u1')).not.toBeNull()
  })

  it('вошёл другой пользователь: чужой кэш стирается в памяти и в хранилище', () => {
    saveCache('u1', { queries: { a: query } })
    const store = makeStore()
    renderSync(store, identity('u2'))
    expect(store.getState().api.queries).toEqual({})
    expect(localStorage.getItem('family-tasks:cache:u1')).toBeNull()
    expect(localStorage.getItem('family-tasks:cache:owner')).toBeNull()
    expect(store.getState().cache.owner).toBe('u2')
  })

  it('выход (входа нет): всё стирается, токена нет', () => {
    saveCache('u1', { queries: { a: query } })
    const store = makeStore()
    setSession({ token: 'старый', memberId: 'u1' })
    renderSync(store, null)
    expect(store.getState().api.queries).toEqual({})
    expect(localStorage.getItem('family-tasks:cache:u1')).toBeNull()
    expect(getSession()).toBeUndefined()
    expect(store.getState().cache.owner).toBeNull()
  })

  it('выход после работы: компонент реагирует на исчезновение входа', () => {
    saveCache('u1', { queries: { a: query } })
    const store = makeStore()
    const { rerender } = renderSync(store, identity('u1'))
    expect(Object.keys(store.getState().api.queries)).toContain('a')
    rerender(
      <Provider store={store}>
        <IdentityContext.Provider value={{ identity: null, save: async () => {}, clear: async () => {} }}>
          <SessionSync />
        </IdentityContext.Provider>
      </Provider>,
    )
    expect(store.getState().api.queries).toEqual({})
  })
})

describe('RealtimeBridge: события сокета сбрасывают кэш', () => {
  it('событие tasks инвалидирует теги заданий с задержкой, одним проходом', async () => {
    vi.useFakeTimers()
    try {
      const listeners = new Set<Listener>()
      const store = makeStore({ hydrate: false })
      const spy = vi.spyOn(api.util, 'invalidateTags')
      render(
        <Provider store={store}>
          <RealtimeContext.Provider value={{ subscribe: (l) => (listeners.add(l), () => void listeners.delete(l)), setViewing: () => {} }}>
            <RealtimeBridge />
          </RealtimeContext.Provider>
        </Provider>,
      )
      act(() => {
        listeners.forEach((l) => l({ type: 'tasks' }))
        listeners.forEach((l) => l({ type: 'tasks' }))
        listeners.forEach((l) => l({ type: 'goals', memberId: 'k' }))
      })
      expect(spy).not.toHaveBeenCalled()
      await act(async () => { await vi.advanceTimersByTimeAsync(300) })
      expect(spy).toHaveBeenCalledTimes(1)
      expect([...spy.mock.calls[0][0] as string[]].sort()).toEqual(['Done', 'Goals', 'Pending', 'Tasks'])
      spy.mockRestore()
    } finally {
      vi.useRealTimers()
    }
  })
})
