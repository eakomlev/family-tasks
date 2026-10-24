import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as api from '@/api'
import { LinkBox } from '@/components/LinkBox'
import { InviteSection } from '@/pages/Invite/components/InviteSection'

vi.mock('@/api', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/api')>()), getInvite: vi.fn(), renewInvite: vi.fn() }))

const FUTURE = new Date(Date.now() + 5 * 24 * 3600 * 1000).toISOString()
const PAST = new Date(Date.now() - 3600 * 1000).toISOString()

beforeEach(() => {
  vi.mocked(api.getInvite).mockReset()
  vi.mocked(api.renewInvite).mockReset()
})
afterEach(() => {
  cleanup()
  delete (navigator as { share?: unknown }).share
})

describe('ссылка-приглашение: выпускается сама', () => {
  it('действующая ссылка показывается как есть, новая не выпускается', async () => {
    vi.mocked(api.getInvite).mockResolvedValue({ code: 'live', expiresAt: FUTURE })
    render(<InviteSection token="tok" />)
    expect(await screen.findByText(/live/)).toBeInTheDocument()
    expect(api.renewInvite).not.toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: /Новая ссылка|Создать ссылку/ })).not.toBeInTheDocument()
  })

  it('ссылки нет (404): новая выпускается автоматически', async () => {
    vi.mocked(api.getInvite).mockRejectedValue(new api.ApiError(404, 'not_found'))
    vi.mocked(api.renewInvite).mockResolvedValue({ code: 'fresh', expiresAt: FUTURE })
    render(<InviteSection token="tok" />)
    expect(await screen.findByText(/fresh/)).toBeInTheDocument()
    expect(api.renewInvite).toHaveBeenCalledTimes(1)
  })

  it('ссылка уже истекла: выпускается новая', async () => {
    vi.mocked(api.getInvite).mockResolvedValue({ code: 'old', expiresAt: PAST })
    vi.mocked(api.renewInvite).mockResolvedValue({ code: 'new', expiresAt: FUTURE })
    render(<InviteSection token="tok" />)
    expect(await screen.findByText(/new/)).toBeInTheDocument()
    expect(screen.queryByText(/old/)).not.toBeInTheDocument()
  })

  it('не получилось: сообщение и «Повторить»', async () => {
    vi.mocked(api.getInvite).mockRejectedValueOnce(new api.ApiError(500, 'internal_error'))
    vi.mocked(api.getInvite).mockResolvedValue({ code: 'again', expiresAt: FUTURE })
    render(<InviteSection token="tok" />)
    expect(await screen.findByText(/Не получилось подготовить ссылку/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Повторить' }))
    expect(await screen.findByText(/again/)).toBeInTheDocument()
  })
})

describe('окно со ссылкой', () => {
  it('копирование значком справа; «Поделиться» только там, где браузер умеет делиться', async () => {
    const writeText = vi.fn(async () => {})
    Object.assign(navigator, { clipboard: { writeText } })
    render(<LinkBox link="https://x.test/join?code=1" expiresAt={FUTURE} />)
    expect(screen.queryByRole('button', { name: 'Поделиться' })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Копировать ссылку' }))
    expect(writeText).toHaveBeenCalledWith('https://x.test/join?code=1')
    await waitFor(() => expect(screen.getByRole('button', { name: 'Скопировано' })).toBeInTheDocument())
  })

  it('«Поделиться» отдаёт ссылку системному меню', async () => {
    const share = vi.fn(async () => {})
    Object.assign(navigator, { share })
    render(<LinkBox link="https://x.test/join?code=2" expiresAt={FUTURE} />)
    await userEvent.click(screen.getByRole('button', { name: 'Поделиться' }))
    expect(share).toHaveBeenCalledWith({ url: 'https://x.test/join?code=2' })
  })
})
