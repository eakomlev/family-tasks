import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/api/client'
import { isConnectionLost, reportNetworkFailure, reportNetworkOk, resetConnection, setNetworkAvailable } from '@/lib/connection'
import { isRetryable, RETRY_DELAY_MS, retryRead } from '@/lib/retry'
import { fromApi } from '@/store/api'
import { setSession } from '@/store/session'

const network = () => new ApiError(0, 'network')

beforeEach(() => {
  vi.useFakeTimers()
  setSession({ token: 'tok', memberId: 'me' })
})
afterEach(() => {
  vi.useRealTimers()
  setSession(undefined)
  resetConnection()
})

describe('isRetryable', () => {
  it('повторяем потерю связи и ответы шлюза, остальное нет', () => {
    expect(isRetryable(network())).toBe(true)
    for (const status of [502, 503, 504]) expect(isRetryable(new ApiError(status, 'x'))).toBe(true)
    for (const status of [400, 401, 403, 404, 409, 500]) expect(isRetryable(new ApiError(status, 'x'))).toBe(false)
    // «нет входа» это не сеть
    expect(isRetryable(new ApiError(0, 'no_session'))).toBe(false)
    expect(isRetryable(new Error('x'))).toBe(false)
  })
})

describe('retryRead', () => {
  it('без связи пробует снова каждые 2–3 секунды, пока не получится', async () => {
    const call = vi.fn().mockRejectedValueOnce(network()).mockRejectedValueOnce(network()).mockResolvedValueOnce('данные')
    const result = retryRead(call)
    await vi.advanceTimersByTimeAsync(0)
    expect(call).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(RETRY_DELAY_MS)
    expect(call).toHaveBeenCalledTimes(2)
    await vi.advanceTimersByTimeAsync(RETRY_DELAY_MS)
    expect(await result).toBe('данные')
    expect(call).toHaveBeenCalledTimes(3)
  })

  it('настоящая ошибка сервера не повторяется', async () => {
    const call = vi.fn().mockRejectedValue(new ApiError(404, 'not_found'))
    await expect(retryRead(call)).rejects.toMatchObject({ status: 404 })
    expect(call).toHaveBeenCalledTimes(1)
  })

  it('экран закрыт (signal): повторы прекращаются', async () => {
    const controller = new AbortController()
    const call = vi.fn().mockRejectedValue(network())
    const result = retryRead(call, controller.signal)
    const caught = result.catch((e) => e)
    await vi.advanceTimersByTimeAsync(0)
    controller.abort()
    await vi.advanceTimersByTimeAsync(0)
    expect(await caught).toMatchObject({ code: 'network' })
    await vi.advanceTimersByTimeAsync(RETRY_DELAY_MS * 3)
    expect(call).toHaveBeenCalledTimes(1)
  })
})

describe('fromApi: чтение повторяется без связи, запись нет', () => {
  it('query ждёт связь и возвращает данные', async () => {
    const call = vi.fn().mockRejectedValueOnce(network()).mockResolvedValueOnce({ ok: 1 })
    const run = fromApi(call)
    const result = run('arg', { type: 'query', signal: new AbortController().signal })
    await vi.advanceTimersByTimeAsync(RETRY_DELAY_MS)
    expect(await result).toEqual({ data: { ok: 1 } })
    expect(call).toHaveBeenCalledTimes(2)
  })

  it('mutation при сетевой ошибке сразу отдаёт ошибку', async () => {
    const call = vi.fn().mockRejectedValue(network())
    const result = await fromApi(call)('arg', { type: 'mutation' })
    expect(result).toEqual({ error: { status: 0, code: 'network', body: {} } })
    expect(call).toHaveBeenCalledTimes(1)
  })
})

describe('состояние связи', () => {
  it('сетевая ошибка включает «нет связи», любой ответ сервера снимает', () => {
    expect(isConnectionLost()).toBe(false)
    reportNetworkFailure()
    expect(isConnectionLost()).toBe(true)
    reportNetworkOk()
    expect(isConnectionLost()).toBe(false)
  })

  it('сообщение системы об отсутствии сети включает, удачный запрос снимает', () => {
    setNetworkAvailable(false)
    expect(isConnectionLost()).toBe(true)
    setNetworkAvailable(true)
    expect(isConnectionLost()).toBe(false)
  })
})
