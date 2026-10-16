import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as api from '@/api'
import type { ChatMediaItem, Member } from '@/api'
import { IdentityContext } from '@/identity/context'
import ChatMedia from '@/pages/ChatMedia'
import { ProfileContext } from '@/profile/context'

vi.mock('@/api', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/api')>()), listChatMedia: vi.fn() }))

const members: Member[] = [
  { id: 'me', name: 'Лена', role: 'mama', avatar: null, isOwner: true },
  { id: 'm2', name: 'Миша', role: 'child', avatar: null, isOwner: false },
]

const item = (id: string): ChatMediaItem => ({
  id,
  width: 1600,
  height: 1200,
  thumbUrl: `/media/f/${id}/thumb?exp=1&sig=a`,
  fullUrl: `/media/f/${id}/full?exp=1&sig=a`,
  messageId: `msg-${id}`,
  senderId: 'm2',
  createdAt: '2026-10-11T10:00:00Z',
})

function renderPage(chat = 'm2') {
  const identity = { familyCode: 'c', memberId: 'me', name: 'Лена', role: 'mama' as const, token: 'tok' }
  render(
    <IdentityContext.Provider value={{ identity, save: async () => {}, clear: async () => {} }}>
      <ProfileContext.Provider value={{ data: { me: { ...members[0], email: 'l@x.y' }, members }, failed: false }}>
        <MemoryRouter initialEntries={[`/chat/${chat}/media`]}>
          <Routes>
            <Route path="/chat/:chat/media" element={<ChatMedia />} />
            <Route path="/chat/:chat" element={<p>Переписка</p>} />
          </Routes>
        </MemoryRouter>
      </ProfileContext.Provider>
    </IdentityContext.Provider>,
  )
}

beforeEach(() => {
  vi.mocked(api.listChatMedia).mockReset()
})
afterEach(cleanup)

describe('медиа файлы чата', () => {
  it('показывает сетку превью, ссылка назад ведёт в чат', async () => {
    vi.mocked(api.listChatMedia).mockResolvedValue({ items: [item('a'), item('b')], hasMore: false })
    renderPage()
    expect(await screen.findAllByRole('button', { name: /^Фото \d/ })).toHaveLength(2)
    expect(screen.getByRole('heading', { name: 'Медиа файлы' })).toBeInTheDocument()
    expect(api.listChatMedia).toHaveBeenCalledWith('tok', 'm2', undefined)
    expect(document.querySelector('img')).toHaveAttribute('src', '/media/f/a/thumb?exp=1&sig=a')
    expect(screen.getByRole('link', { name: /Миша/ })).toHaveAttribute('href', '/chat/m2')
  })

  it('пустой чат: подсказка', async () => {
    vi.mocked(api.listChatMedia).mockResolvedValue({ items: [], hasMore: false })
    renderPage('family')
    expect(await screen.findByText('В этом чате пока нет фото.')).toBeInTheDocument()
  })

  it('«Показать ещё» подгружает старые фото после последнего загруженного, без повторов', async () => {
    vi.mocked(api.listChatMedia)
      .mockResolvedValueOnce({ items: [item('a'), item('b')], hasMore: true })
      .mockResolvedValueOnce({ items: [item('b'), item('c')], hasMore: false })
    renderPage()
    await userEvent.click(await screen.findByRole('button', { name: 'Показать ещё' }))
    await waitFor(() => expect(screen.getAllByRole('button', { name: /^Фото \d/ })).toHaveLength(3))
    expect(api.listChatMedia).toHaveBeenLastCalledWith('tok', 'm2', 'b')
    expect(screen.queryByRole('button', { name: 'Показать ещё' })).not.toBeInTheDocument()
  })

  it('нажатие на превью открывает просмотр на нужном фото, закрытие возвращает к сетке', async () => {
    vi.mocked(api.listChatMedia).mockResolvedValue({ items: [item('a'), item('b')], hasMore: false })
    renderPage()
    const thumbs = await screen.findAllByRole('button', { name: /^Фото \d/ })
    await userEvent.click(thumbs[1])
    const viewer = await screen.findByRole('dialog')
    expect(within(viewer).getByText(/2\s*\/\s*2|2 из 2/)).toBeInTheDocument()
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('ошибка первой загрузки: сообщение и «Повторить»', async () => {
    vi.mocked(api.listChatMedia).mockRejectedValueOnce(new Error('x')).mockResolvedValueOnce({ items: [item('a')], hasMore: false })
    renderPage()
    expect(await screen.findByText(/Не удалось загрузить фото/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Повторить' }))
    expect(await screen.findAllByRole('button', { name: /^Фото \d/ })).toHaveLength(1)
  })
})
