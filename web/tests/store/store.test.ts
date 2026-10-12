import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { api, TAGS } from '@/store/api'
import { ownerChanged } from '@/store/cache'
import { createInvalidator, tagsForEvent } from '@/store/invalidate'
import { attachPersistence, makeStore } from '@/store'
import { CACHE_VERSION, clearCache, loadCache, MAX_AGE_MS, MAX_BYTES, saveCache, snapshot } from '@/store/persist'
import { setSession } from '@/store/session'

// тестовый запрос: у настоящих появится в фазах 1-5
const thing = api.injectEndpoints({
  endpoints: (build) => ({
    thing: build.query<{ n: number }, string>({ query: (id) => ({ path: `/thing/${id}` }), providesTags: ['Me'] }),
  }),
})

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

function mockFetch(handler: (url: string) => Response | Promise<Response>) {
  const fn = vi.fn<typeof fetch>(async (input) => handler(String(input)))
  vi.stubGlobal('fetch', fn)
  return fn
}

beforeEach(() => {
  localStorage.clear()
  setSession({ token: 'tok', memberId: 'u1' })
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
  setSession(undefined)
})

describe('кэш в localStorage: круг запрос, сохранение, новая страница', () => {
  it('после перезапуска данные есть на первом кадре, без единого запроса', async () => {
    const fetchMock = mockFetch(() => json({ n: 7 }))
    const first = makeStore({ hydrate: false })
    const sub = first.dispatch(thing.endpoints.thing.initiate('a'))
    await sub
    expect(thing.endpoints.thing.select('a')(first.getState()).data).toEqual({ n: 7 })
    first.dispatch(ownerChanged('u1'))
    expect(saveCache('u1', first.getState().api)).toBe(true)
    sub.unsubscribe()
    expect(fetchMock).toHaveBeenCalledTimes(1)

    // «новая страница»: свежее хранилище читает localStorage синхронно
    const second = makeStore()
    expect(second.getState().cache.hydratedFor).toBe('u1')
    expect(thing.endpoints.thing.select('a')(second.getState()).data).toEqual({ n: 7 })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('запись идёт сама, с задержкой, и только когда известно, кто вошёл', async () => {
    vi.useFakeTimers()
    mockFetch(() => json({ n: 1 }))
    const store = makeStore({ hydrate: false })
    const detach = attachPersistence(store, 1000)
    await store.dispatch(thing.endpoints.thing.initiate('b'))
    await vi.advanceTimersByTimeAsync(1500)
    expect(localStorage.getItem('family-tasks:cache:owner')).toBeNull()

    store.dispatch(ownerChanged('u1'))
    await store.dispatch(thing.endpoints.thing.initiate('c'))
    await vi.advanceTimersByTimeAsync(1500)
    expect(localStorage.getItem('family-tasks:cache:owner')).toBe('u1')
    expect(loadCache()?.api.queries).toBeTruthy()
    detach()
  })

  it('данные из кэша обновляются в фоне при открытии экрана: старше 30 секунд запрашиваются заново, свежие нет', async () => {
    const fetchMock = mockFetch(() => json({ n: 2 }))
    const store = makeStore({ hydrate: false })
    const a = store.dispatch(thing.endpoints.thing.initiate('d'))
    await a
    a.unsubscribe()
    expect(fetchMock).toHaveBeenCalledTimes(1)
    // свежие данные: повторное открытие экрана запроса не делает
    await store.dispatch(thing.endpoints.thing.initiate('d'))
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})

describe('срок, версия, размер, квота', () => {
  const query = (age: number, extra = '') => ({ status: 'fulfilled', endpointName: 'thing', fulfilledTimeStamp: Date.now() - age, data: { x: extra } })

  it('старше недели выбрасывается при сохранении и при загрузке', () => {
    const snap = snapshot({ queries: { fresh: query(1000), old: query(MAX_AGE_MS + 1000) } })
    expect(Object.keys(snap.queries)).toEqual(['fresh'])

    saveCache('u1', { queries: { fresh: query(1000) } })
    const stored = JSON.parse(localStorage.getItem('family-tasks:cache:u1')!)
    stored.savedAt = Date.now() - MAX_AGE_MS - 1
    localStorage.setItem('family-tasks:cache:u1', JSON.stringify(stored))
    expect(loadCache()).toBeUndefined()
  })

  it('другая версия схемы: кэш выбрасывается', () => {
    saveCache('u1', { queries: { fresh: query(1000) } })
    const stored = JSON.parse(localStorage.getItem('family-tasks:cache:u1')!)
    stored.v = CACHE_VERSION + 1
    localStorage.setItem('family-tasks:cache:u1', JSON.stringify(stored))
    expect(loadCache()).toBeUndefined()
    expect(localStorage.getItem('family-tasks:cache:u1')).toBeNull()
  })

  it('не выполненные и ошибочные запросы не сохраняются', () => {
    const snap = snapshot({ queries: { ok: query(1), loading: { status: 'pending' }, bad: { status: 'rejected', fulfilledTimeStamp: Date.now() } } })
    expect(Object.keys(snap.queries)).toEqual(['ok'])
  })

  it('бюджет размера: самые свежие остаются, самые тяжёлые старые отбрасываются', () => {
    const big = 'x'.repeat(Math.floor(MAX_BYTES * 0.6))
    const snap = snapshot({ queries: { new: query(10, big), mid: query(1000, big), tiny: query(2000) } })
    expect(Object.keys(snap.queries).sort()).toEqual(['new', 'tiny'])
  })

  it('теги сохраняются только у оставшихся запросов', () => {
    const snap = snapshot({
      queries: { keep: query(1) },
      provided: { keys: { keep: [{ type: 'Me' }], gone: [{ type: 'Me' }] }, tags: { Me: { __internal_without_id: ['keep', 'gone'] } } },
    })
    expect(snap.provided.keys).toEqual({ keep: [{ type: 'Me' }] })
    expect(snap.provided.tags.Me.__internal_without_id).toEqual(['keep'])
  })

  it('ошибка квоты не ломает приложение', () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('quota', 'QuotaExceededError')
    })
    expect(saveCache('u1', { queries: { a: query(1) } })).toBe(false)
    setItem.mockRestore()
  })

  it('битый JSON в хранилище игнорируется', () => {
    localStorage.setItem('family-tasks:cache:owner', 'u1')
    localStorage.setItem('family-tasks:cache:u1', '{не json')
    expect(loadCache()).toBeUndefined()
  })

  it('при сохранении чужие записи на устройстве стираются: остаётся кэш только текущего пользователя', () => {
    saveCache('old', { queries: { a: query(1) } })
    localStorage.setItem('theme', 'dark')
    saveCache('new', { queries: { a: query(1) } })
    expect(localStorage.getItem('family-tasks:cache:old')).toBeNull()
    expect(localStorage.getItem('family-tasks:cache:new')).not.toBeNull()
    expect(localStorage.getItem('family-tasks:cache:owner')).toBe('new')
    expect(localStorage.getItem('theme')).toBe('dark')
  })

  it('очистка стирает кэш всех пользователей и указатель, чужие ключи не трогает', () => {
    saveCache('u1', { queries: { a: query(1) } })
    saveCache('u2', { queries: { a: query(1) } })
    localStorage.setItem('theme', 'dark')
    clearCache()
    expect(localStorage.getItem('family-tasks:cache:u1')).toBeNull()
    expect(localStorage.getItem('family-tasks:cache:u2')).toBeNull()
    expect(localStorage.getItem('family-tasks:cache:owner')).toBeNull()
    expect(localStorage.getItem('theme')).toBe('dark')
  })
})

describe('инвалидация по событиям сокета', () => {
  it('события сопоставлены с тегами; resync сбрасывает всё', () => {
    expect(tagsForEvent({ type: 'tasks' })).toEqual(['Tasks', 'Pending', 'Done'])
    expect(tagsForEvent({ type: 'members' })).toContain('Me')
    expect(tagsForEvent({ type: 'schedule', memberId: 'k' })).toEqual([{ type: 'Schedule', id: 'k' }])
    expect(tagsForEvent({ type: 'trainings', memberId: 'k' })).toEqual([{ type: 'Trainings', id: 'k' }])
    expect(tagsForEvent({ type: 'chat', chat: 'family' })).toEqual(['Chats', { type: 'Messages', id: 'family' }])
    expect(tagsForEvent({ type: 'resync' })).toEqual(TAGS)
  })

  it('пачка событий склеивается в один проход', async () => {
    vi.useFakeTimers()
    const flush = vi.fn()
    const invalidate = createInvalidator(flush, 200)
    invalidate(['Tasks'])
    invalidate(['Tasks', 'Me'])
    invalidate(['Goals'])
    expect(flush).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(250)
    expect(flush).toHaveBeenCalledTimes(1)
    expect([...flush.mock.calls[0][0]].sort()).toEqual(['Goals', 'Me', 'Tasks'])
  })

  it('инвалидация тега заставляет активный запрос обновиться, неактивный удаляет', async () => {
    let n = 0
    const fetchMock = mockFetch(() => json({ n: ++n }))
    const store = makeStore({ hydrate: false })
    const active = store.dispatch(thing.endpoints.thing.initiate('live'))
    await active
    const idle = store.dispatch(thing.endpoints.thing.initiate('idle'))
    await idle
    idle.unsubscribe()
    expect(fetchMock).toHaveBeenCalledTimes(2)

    store.dispatch(api.util.invalidateTags(['Me']))
    await vi.waitFor(() => expect(thing.endpoints.thing.select('live')(store.getState()).data).toEqual({ n: 3 }))
    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(thing.endpoints.thing.select('idle')(store.getState()).data).toBeUndefined()
    active.unsubscribe()
  })
})
