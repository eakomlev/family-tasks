import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CaptchaNotice } from '@/components/CaptchaNotice'
import { resetCaptcha } from '@/lib/captcha'

const fetchMock = vi.fn()
const config = (siteKey: string | null) =>
  fetchMock.mockImplementation(async () => new Response(JSON.stringify({ siteKey }), { status: 200 }))

beforeEach(() => {
  resetCaptcha()
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('строка про SmartCaptcha вместо скрытой плашки', () => {
  it('капча включена: строка со ссылками на условия, ссылки открываются в новой вкладке', async () => {
    config('site-key')
    render(<CaptchaNotice />)
    expect(await screen.findByText(/Защищено Yandex SmartCaptcha/)).toBeInTheDocument()
    const links = screen.getAllByRole('link')
    expect(links).toHaveLength(2)
    links.forEach((link) => expect(link).toHaveAttribute('target', '_blank'))
  })

  it('капча выключена на сервере: строки нет', async () => {
    config(null)
    render(<CaptchaNotice />)
    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    expect(screen.queryByText(/SmartCaptcha/)).not.toBeInTheDocument()
  })

  it('сервер не ответил: строки нет и ошибки не видно', async () => {
    fetchMock.mockRejectedValue(new Error('offline'))
    render(<CaptchaNotice />)
    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    expect(screen.queryByText(/SmartCaptcha/)).not.toBeInTheDocument()
  })
})
