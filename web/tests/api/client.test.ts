import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, completeTask, createTask, deleteTask, getTask, listTasks } from '@/api'
import { request, send } from '@/api/client'

// фабрика: тело Response можно прочитать только один раз, а запросов в тесте бывает несколько
function mockFetch(response: Response | Error | (() => Response)) {
  const fn = vi.fn<typeof fetch>(async () => {
    if (response instanceof Error) throw response
    return typeof response === 'function' ? response() : response.clone()
  })
  vi.stubGlobal('fetch', fn)
  return fn
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

afterEach(() => vi.unstubAllGlobals())

describe('request', () => {
  it('добавляет /api и токен, возвращает JSON', async () => {
    const fetchMock = mockFetch(json({ ok: 1 }))
    await expect(request('/x', {}, 'tok')).resolves.toEqual({ ok: 1 })
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('/api/x')
    expect(new Headers(init.headers).get('Authorization')).toBe('Bearer tok')
  })

  it('без токена заголовка Authorization нет', async () => {
    const fetchMock = mockFetch(json({}))
    await request('/x')
    const init = fetchMock.mock.calls[0][1] as RequestInit
    expect(new Headers(init.headers).has('Authorization')).toBe(false)
  })

  it('Content-Type ставится только при теле', async () => {
    const fetchMock = mockFetch(() => json({}))
    await request('/x', send('POST', { a: 1 }))
    await request('/x', send('POST'))
    const withBody = new Headers((fetchMock.mock.calls[0][1] as RequestInit).headers)
    const withoutBody = new Headers((fetchMock.mock.calls[1][1] as RequestInit).headers)
    expect(withBody.get('Content-Type')).toBe('application/json')
    expect(withoutBody.has('Content-Type')).toBe(false)
  })

  it('204 даёт undefined', async () => {
    mockFetch(new Response(null, { status: 204 }))
    await expect(request('/x')).resolves.toBeUndefined()
  })

  it('ошибка сервера становится ApiError с кодом, статусом и телом', async () => {
    mockFetch(json({ error: 'name_taken', extra: 5 }, 409))
    const err = await request('/x').catch((e) => e)
    expect(err).toBeInstanceOf(ApiError)
    expect(err).toMatchObject({ status: 409, code: 'name_taken', body: { error: 'name_taken', extra: 5 } })
  })

  it('ответ-ошибка без JSON даёт код unknown', async () => {
    mockFetch(new Response('<html>502</html>', { status: 502 }))
    const err = await request('/x').catch((e) => e)
    expect(err).toMatchObject({ status: 502, code: 'unknown' })
  })

  it('обрыв связи даёт код network и статус 0', async () => {
    mockFetch(new TypeError('Failed to fetch'))
    const err = await request('/x').catch((e) => e)
    expect(err).toMatchObject({ status: 0, code: 'network' })
  })
})

describe('запросы заданий', () => {
  it('нужные методы, пути и тела', async () => {
    const fetchMock = mockFetch(() => json({}))
    await listTasks('t', '2026-10-01', '2026-10-07')
    await getTask('t', 'a/b')
    await createTask('t', { title: 'x', description: '', assigneeId: 'm', date: null, time: null, repeat: { type: 'none', days: [], until: null } })
    await completeTask('t', 'id1', '2026-10-11')
    await completeTask('t', 'id1', null)
    await deleteTask('t', 'id1')

    const calls = fetchMock.mock.calls.map(([url, init]) => {
      const i = init as RequestInit
      return [url as string, i.method ?? 'GET', i.body as string | undefined] as const
    })
    expect(calls[0]).toEqual(['/api/tasks?from=2026-10-01&to=2026-10-07', 'GET', undefined])
    expect(calls[1][0]).toBe('/api/tasks/a%2Fb')
    expect(calls[2][1]).toBe('POST')
    expect(calls[3]).toEqual(['/api/tasks/id1/complete', 'POST', JSON.stringify({ date: '2026-10-11' })])
    expect(calls[4][2]).toBe(JSON.stringify({ date: null }))
    expect(calls[5][1]).toBe('DELETE')
  })
})
