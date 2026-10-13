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
    await listTasks('t', '2026-10-01', '2026-10-07', { collapse: true })
    await getTask('t', 'a/b')
    await createTask('t', { title: 'x', description: '', reward: 0, assigneeId: 'm', date: null, time: null, repeat: { type: 'none', days: [], until: null } })
    await completeTask('t', 'id1', '2026-10-11')
    await completeTask('t', 'id1', null)
    await deleteTask('t', 'id1')

    const calls = fetchMock.mock.calls.map(([url, init]) => {
      const i = init as RequestInit
      return [url as string, i.method ?? 'GET', i.body as string | undefined] as const
    })
    expect(calls[0]).toEqual(['/api/tasks?from=2026-10-01&to=2026-10-07', 'GET', undefined])
    expect(calls[1][0]).toBe('/api/tasks?from=2026-10-01&to=2026-10-07&collapse=true')
    expect(calls[2][0]).toBe('/api/tasks/a%2Fb')
    expect(calls[3][1]).toBe('POST')
    expect(calls[4]).toEqual(['/api/tasks/id1/complete', 'POST', JSON.stringify({ date: '2026-10-11' })])
    expect(calls[5][2]).toBe(JSON.stringify({ date: null }))
    expect(calls[6][1]).toBe('DELETE')
  })
})

describe('request: ответ 429 («слишком часто»)', () => {
  const limited = () => new Response(JSON.stringify({ error: 'rate' }), { status: 429, headers: { 'Retry-After': '1' } })

  it('чтение после 429 повторяется и возвращает данные', async () => {
    vi.useFakeTimers()
    try {
      let calls = 0
      const fetchMock = vi.fn<typeof fetch>(async () => (++calls === 1 ? limited() : json({ ok: 1 })))
      vi.stubGlobal('fetch', fetchMock)
      const result = request('/x', {}, 'tok')
      await vi.advanceTimersByTimeAsync(1000)
      await expect(result).resolves.toEqual({ ok: 1 })
      expect(fetchMock).toHaveBeenCalledTimes(2)
    } finally {
      vi.useRealTimers()
    }
  })

  it('если лимит не снимается, после двух повторов ошибка 429', async () => {
    vi.useFakeTimers()
    try {
      const fetchMock = vi.fn<typeof fetch>(async () => limited())
      vi.stubGlobal('fetch', fetchMock)
      const result = request('/x', {}, 'tok').catch((err) => err)
      await vi.advanceTimersByTimeAsync(10_000)
      const err = await result
      expect(err).toBeInstanceOf(ApiError)
      expect((err as ApiError).status).toBe(429)
      expect(fetchMock).toHaveBeenCalledTimes(3)
    } finally {
      vi.useRealTimers()
    }
  })

  it('изменяющие запросы при 429 не повторяются сами', async () => {
    const fetchMock = mockFetch(limited)
    await expect(request('/x', send('POST', { a: 1 }), 'tok')).rejects.toMatchObject({ status: 429 })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})

describe('фото в чате', () => {
  it('uploadChatPhoto: POST тела как есть, тип image/jpeg (не JSON), токен, ответ разобран', async () => {
    const { uploadChatPhoto } = await import('@/api')
    const fetchMock = mockFetch(json({ mediaId: 'id-1', width: 800, height: 600 }, 201))
    const photo = new Blob([new Uint8Array([1, 2, 3])], { type: 'image/jpeg' })
    await expect(uploadChatPhoto('tok', 'family', photo)).resolves.toEqual({ mediaId: 'id-1', width: 800, height: 600 })
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('/api/chats/family/media')
    expect(init.method).toBe('POST')
    expect(init.body).toBe(photo)
    const headers = new Headers(init.headers)
    expect(headers.get('Content-Type')).toBe('image/jpeg')
    expect(headers.get('Authorization')).toBe('Bearer tok')
  })

  it('uploadChatPhoto: код ошибки сервера доходит до вызывающего', async () => {
    const { uploadChatPhoto } = await import('@/api')
    mockFetch(json({ error: 'media_quota' }, 413))
    await expect(uploadChatPhoto('tok', 'family', new Blob(['x']))).rejects.toMatchObject({ status: 413, code: 'media_quota' })
  })

  it('sendMessage: без фото тело прежнее {text}, с фото добавляется mediaIds', async () => {
    const { sendMessage } = await import('@/api')
    const fetchMock = mockFetch(() => json({ message: {} }, 201))
    await sendMessage('tok', 'family', 'привет')
    await sendMessage('tok', 'family', '', ['a', 'b'])
    await sendMessage('tok', 'family', 'подпись', [])
    const bodies = fetchMock.mock.calls.map((c) => JSON.parse((c[1] as RequestInit).body as string))
    expect(bodies).toEqual([{ text: 'привет' }, { text: '', mediaIds: ['a', 'b'] }, { text: 'подпись' }])
    expect(new Headers((fetchMock.mock.calls[1][1] as RequestInit).headers).get('Content-Type')).toBe('application/json')
  })
})
