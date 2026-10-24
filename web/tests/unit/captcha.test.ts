import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { requestEmailCode } from '@/api'
import { getCaptchaToken, resetCaptcha } from '@/lib/captcha'
import { describeCodeError, describeResendError } from '@/lib/errors'
import { ApiError } from '@/api/client'

type Handler = (...args: string[]) => void

// Подмена виджета SmartCaptcha: execute вызывает заданное поведение
function installWidget(onExecute: (emit: (event: string, ...args: string[]) => void) => void) {
  const handlers = new Map<string, Handler[]>()
  const emit = (event: string, ...args: string[]) => handlers.get(event)?.forEach((h) => h(...args))
  const widget = {
    render: vi.fn((_container: HTMLElement, _params: Record<string, unknown>) => 7),
    reset: vi.fn(),
    execute: vi.fn(() => queueMicrotask(() => onExecute(emit))),
    subscribe: vi.fn((_id: number, event: string, cb: Handler) => {
      handlers.set(event, [...(handlers.get(event) ?? []), cb])
      return () => handlers.set(event, (handlers.get(event) ?? []).filter((h) => h !== cb))
    }),
  }
  window.smartCaptcha = widget
  return widget
}

const fetchMock = vi.fn()
const config = (siteKey: string | null) => fetchMock.mockImplementation(async (url: string) =>
  String(url).includes('/captcha/config') ? new Response(JSON.stringify({ siteKey }), { status: 200 }) : new Response(null, { status: 204 }),
)

beforeEach(() => {
  resetCaptcha()
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => {
  delete window.smartCaptcha
  document.querySelectorAll('script[data-smartcaptcha]').forEach((el) => el.remove())
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('капча перед отправкой кода', () => {
  it('на сервере капча выключена: токена нет, виджет не создаётся', async () => {
    config(null)
    const widget = installWidget(() => {})
    expect(await getCaptchaToken()).toBeUndefined()
    expect(widget.render).not.toHaveBeenCalled()
  })

  it('невидимый виджет создаётся один раз, на каждую отправку новая проверка и свежий токен', async () => {
    config('site-key')
    let n = 0
    const widget = installWidget((emit) => emit('success', `token-${++n}`))
    expect(await getCaptchaToken()).toBe('token-1')
    expect(await getCaptchaToken()).toBe('token-2')
    expect(widget.render).toHaveBeenCalledTimes(1)
    // плашка Яндекса в углу страницы скрыта: вместо неё строка со ссылками (CaptchaNotice)
    expect(widget.render.mock.calls[0][1]).toMatchObject({ sitekey: 'site-key', invisible: true, hideShield: true })
    expect(widget.reset).toHaveBeenCalledTimes(2)
    expect(widget.execute).toHaveBeenCalledTimes(2)
    // ключ клиента запрашивается один раз
    expect(fetchMock.mock.calls.filter(([url]) => String(url).includes('/captcha/config'))).toHaveLength(1)
  })

  it('одновременные вызовы делят одну проверку', async () => {
    config('site-key')
    const widget = installWidget((emit) => emit('success', 'one'))
    const [a, b] = await Promise.all([getCaptchaToken(), getCaptchaToken()])
    expect([a, b]).toEqual(['one', 'one'])
    expect(widget.execute).toHaveBeenCalledTimes(1)
  })

  it('окно с заданием закрыли без решения: captcha_cancelled', async () => {
    config('site-key')
    installWidget((emit) => emit('challenge-hidden'))
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const result = getCaptchaToken().catch((e) => e)
    await vi.advanceTimersByTimeAsync(600)
    expect(await result).toMatchObject({ status: 0, code: 'captcha_cancelled' })
  })

  it('задание решили: закрытие окна сразу после успеха не отменяет проверку', async () => {
    config('site-key')
    installWidget((emit) => {
      emit('success', 'ok-token')
      emit('challenge-hidden')
    })
    expect(await getCaptchaToken()).toBe('ok-token')
  })

  it('сбой виджета: captcha_unavailable', async () => {
    config('site-key')
    installWidget((emit) => emit('network-error'))
    await expect(getCaptchaToken()).rejects.toMatchObject({ code: 'captcha_unavailable' })
  })

  it('скрипт Яндекса не загрузился: captcha_unavailable, при следующей попытке пробует снова', async () => {
    config('site-key')
    const attempt = getCaptchaToken().catch((e) => e)
    // ждём, пока скрипт добавится в документ, и имитируем сбой загрузки
    await vi.waitFor(() => expect(document.querySelector('script[data-smartcaptcha]')).not.toBeNull())
    ;(document.querySelector('script[data-smartcaptcha]') as HTMLScriptElement).onerror?.(new Event('error'))
    expect(await attempt).toMatchObject({ code: 'captcha_unavailable' })
    const retry = getCaptchaToken().catch((e) => e)
    await vi.waitFor(() => expect(document.querySelector('script[data-smartcaptcha]')).not.toBeNull())
    installWidget((emit) => emit('success', 'late'))
    window.__smartCaptchaReady?.()
    expect(await retry).toBe('late')
  })
})

describe('requestEmailCode', () => {
  it('с капчей токен уходит в теле запроса', async () => {
    config('site-key')
    installWidget((emit) => emit('success', 'tok-1'))
    await requestEmailCode('a@b.co', 'signup')
    const call = fetchMock.mock.calls.find(([url]) => String(url) === '/api/email-codes')!
    expect(JSON.parse((call[1] as RequestInit).body as string)).toEqual({ email: 'a@b.co', purpose: 'signup', captchaToken: 'tok-1' })
  })

  it('без капчи тело прежнее', async () => {
    config(null)
    await requestEmailCode('a@b.co', 'login')
    const call = fetchMock.mock.calls.find(([url]) => String(url) === '/api/email-codes')!
    expect(JSON.parse((call[1] as RequestInit).body as string)).toEqual({ email: 'a@b.co', purpose: 'login' })
  })

  it('проверка не пройдена: код не запрашивается', async () => {
    config('site-key')
    installWidget((emit) => emit('network-error'))
    await expect(requestEmailCode('a@b.co', 'signup')).rejects.toMatchObject({ code: 'captcha_unavailable' })
    expect(fetchMock.mock.calls.some(([url]) => String(url) === '/api/email-codes')).toBe(false)
  })
})

describe('тексты ошибок капчи', () => {
  it('отмена, сбой и отказ сервера понятны человеку', () => {
    for (const describe of [describeCodeError, describeResendError]) {
      expect(describe(new ApiError(0, 'captcha_cancelled'))).toMatch(/Проверка не пройдена/)
      expect(describe(new ApiError(400, 'captcha_failed'))).toMatch(/Проверка не пройдена/)
      expect(describe(new ApiError(400, 'captcha_required'))).toMatch(/Проверка не пройдена/)
      expect(describe(new ApiError(0, 'captcha_unavailable'))).toMatch(/загрузить проверку/)
    }
  })
})
