import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/api/client'
import { getCaptchaToken, registerCaptchaRunner, resetCaptcha } from '@/lib/captcha'
import { captchaHtml, parseCaptchaMessage } from '@/lib/captchaPage'
import { describeCodeError, describeResendError } from '@/lib/errors'

const fetchMock = vi.fn()
const config = (siteKey: string | null) =>
  fetchMock.mockImplementation(async (url: string) => (String(url).includes('/captcha/config') ? new Response(JSON.stringify({ siteKey }), { status: 200 }) : new Response(null, { status: 204 })))

beforeEach(() => {
  resetCaptcha()
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => vi.unstubAllGlobals())

describe('капча перед отправкой кода', () => {
  it('на сервере капча выключена: токена нет, проверка не запускается', async () => {
    config(null)
    const runner = vi.fn()
    registerCaptchaRunner(runner)
    expect(await getCaptchaToken()).toBeUndefined()
    expect(runner).not.toHaveBeenCalled()
  })

  it('капча включена: токен берётся у исполнителя, на каждую отправку новый', async () => {
    config('site-key')
    const runner = vi.fn().mockResolvedValueOnce('token-1').mockResolvedValueOnce('token-2')
    registerCaptchaRunner(runner)
    expect(await getCaptchaToken()).toBe('token-1')
    expect(await getCaptchaToken()).toBe('token-2')
    expect(runner).toHaveBeenCalledWith('site-key')
    // ключ клиента запрашивается один раз
    expect(fetchMock.mock.calls.filter(([url]) => String(url).includes('/captcha/config'))).toHaveLength(1)
  })

  it('одновременные вызовы делят одну проверку', async () => {
    config('site-key')
    const runner = vi.fn().mockResolvedValue('shared')
    registerCaptchaRunner(runner)
    const [a, b] = await Promise.all([getCaptchaToken(), getCaptchaToken()])
    expect([a, b]).toEqual(['shared', 'shared'])
    expect(runner).toHaveBeenCalledTimes(1)
  })

  it('окно с заданием закрыли: captcha_cancelled, потом можно снова', async () => {
    config('site-key')
    registerCaptchaRunner(vi.fn().mockRejectedValueOnce(new ApiError(0, 'captcha_cancelled')).mockResolvedValueOnce('ok'))
    await expect(getCaptchaToken()).rejects.toMatchObject({ code: 'captcha_cancelled' })
    expect(await getCaptchaToken()).toBe('ok')
  })

  it('нет исполнителя (WebView не подключён): captcha_unavailable', async () => {
    config('site-key')
    await expect(getCaptchaToken()).rejects.toMatchObject({ code: 'captcha_unavailable' })
  })

  it('тексты ошибок для человека', () => {
    expect(describeCodeError(new ApiError(0, 'captcha_cancelled'))).toMatch(/Проверка не пройдена/)
    expect(describeCodeError(new ApiError(0, 'captcha_unavailable'))).toMatch(/загрузить проверку/)
    expect(describeResendError(new ApiError(400, 'captcha_required'))).toMatch(/Проверка не пройдена/)
  })
})

describe('страница капчи для WebView', () => {
  it('ключ клиента подставляется в страницу, опасные символы экранируются', () => {
    const html = captchaHtml('abc"</script><b>')
    expect(html).toContain('smartcaptcha.cloud.yandex.ru/captcha.js')
    expect(html).toContain('invisible: true')
    expect(html).not.toContain('</script><b>')
    expect(html).toContain('\u003c/script>')
  })

  it('сообщения страницы разбираются, лишнее отбрасывается', () => {
    expect(parseCaptchaMessage('{"type":"success","token":"t1"}')).toEqual({ type: 'success', token: 't1' })
    expect(parseCaptchaMessage('{"type":"visible"}')).toEqual({ type: 'visible' })
    expect(parseCaptchaMessage('{"type":"hidden"}')).toEqual({ type: 'hidden' })
    expect(parseCaptchaMessage('{"type":"error"}')).toEqual({ type: 'error' })
    expect(parseCaptchaMessage('{"type":"success"}')).toBeNull()
    expect(parseCaptchaMessage('{"type":"success","token":""}')).toBeNull()
    expect(parseCaptchaMessage('не json')).toBeNull()
    expect(parseCaptchaMessage('{"type":"что-то"}')).toBeNull()
    expect(parseCaptchaMessage('null')).toBeNull()
  })
})
