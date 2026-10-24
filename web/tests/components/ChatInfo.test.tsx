import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Provider } from 'react-redux'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as api from '@/api'
import type { ChatMediaItem, Member } from '@/api'
import { ChatsContext } from '@/chat/context'
import { IdentityContext } from '@/identity/context'
import ChatInfo from '@/pages/ChatInfo'
import { ProfileContext } from '@/profile/context'
import { makeStore } from '@/store'
import { setSession } from '@/store/session'

vi.mock('@/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/api')>()),
  listChatMedia: vi.fn(),
  listChatLinks: vi.fn(),
  searchChatMessages: vi.fn(),
  setChatMuted: vi.fn(),
}))

const members: Member[] = [
  { id: 'me', name: 'Лена', role: 'mama', avatar: null, isOwner: true },
  { id: 'm2', name: 'Миша', role: 'child', avatar: null, isOwner: false, birthDate: '2016-03-05' } as Member,
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

function renderPage(chat = 'm2', muted = false) {
  setSession({ token: 'tok', memberId: 'me' })
  const identity = { familyCode: 'c', memberId: 'me', name: 'Лена', role: 'mama' as const, token: 'tok' }
  const chats = [{ id: chat, last: null, unread: 0, muted, readUpTo: null }]
  render(
    <Provider store={makeStore({ hydrate: false })}>
      <IdentityContext.Provider value={{ identity, save: async () => {}, clear: async () => {} }}>
        <ProfileContext.Provider value={{ data: { me: { ...members[0], email: 'l@x.y' }, members }, failed: false }}>
          <ChatsContext.Provider value={{ chats, unread: 0 }}>
            <MemoryRouter initialEntries={[`/chat/${chat}/info`]}>
              <Routes>
                <Route path="/chat/:chat/info" element={<ChatInfo />} />
                <Route path="/chat/:chat" element={<p>Переписка</p>} />
                <Route path="/family/:id" element={<p>Профиль</p>} />
              </Routes>
            </MemoryRouter>
          </ChatsContext.Provider>
        </ProfileContext.Provider>
      </IdentityContext.Provider>
    </Provider>,
  )
}

beforeEach(() => {
  vi.mocked(api.listChatMedia).mockReset().mockResolvedValue({ items: [], hasMore: false })
  vi.mocked(api.listChatLinks).mockReset().mockResolvedValue({ items: [], hasMore: false, lastMessageId: null })
  vi.mocked(api.searchChatMessages).mockReset().mockResolvedValue({ messages: [], hasMore: false })
  vi.mocked(api.setChatMuted).mockReset().mockResolvedValue(undefined)
})
afterEach(cleanup)

describe('информация о чате', () => {
  it('личный чат: собеседник, роль, дата рождения, ссылка на профиль', async () => {
    renderPage('m2')
    expect(await screen.findByRole('heading', { name: 'Миша' })).toBeInTheDocument()
    expect(screen.getByText('Ребёнок')).toBeInTheDocument()
    expect(screen.getByText(/5 марта 2016/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Открыть профиль' })).toHaveAttribute('href', '/family/m2')
  })

  it('общий чат: название и число участников, без профиля', async () => {
    renderPage('family')
    expect(await screen.findByRole('heading', { name: 'Общий чат' })).toBeInTheDocument()
    expect(screen.getByText('2 участника')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Открыть профиль' })).not.toBeInTheDocument()
  })

  it('уведомления: переключатель вызывает API', async () => {
    renderPage('m2')
    const toggle = await screen.findByRole('switch', { name: 'Уведомления' })
    expect(toggle).toHaveAttribute('aria-checked', 'true')
    await userEvent.click(toggle)
    await waitFor(() => expect(api.setChatMuted).toHaveBeenCalledWith('tok', 'm2', true))
  })

  it('вкладка «Медиа»: все фото сеткой', async () => {
    vi.mocked(api.listChatMedia).mockResolvedValue({ items: [item('a'), item('b')], hasMore: false })
    renderPage('m2')
    expect(await screen.findByRole('button', { name: 'Фото 1' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Фото 2' })).toBeInTheDocument()
    expect(api.listChatMedia).toHaveBeenCalledWith('tok', 'm2', undefined)
  })

  it('вкладка «Ссылки»: ссылки с автором, открываются в новой вкладке', async () => {
    vi.mocked(api.listChatLinks).mockResolvedValue({
      items: [{ url: 'https://example.com/a', messageId: 'x', senderId: 'm2', createdAt: '2026-10-11T10:00:00Z' }],
      hasMore: false,
      lastMessageId: 'x',
    })
    renderPage('m2')
    await userEvent.click(await screen.findByRole('tab', { name: 'Ссылки' }))
    const link = await screen.findByRole('link', { name: /example\.com\/a/ })
    expect(link).toHaveAttribute('href', 'https://example.com/a')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveTextContent('Миша')
  })

  it('пустые вкладки объясняют, что пусто', async () => {
    renderPage('m2')
    expect(await screen.findByText('В этом чате пока нет фото.')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('tab', { name: 'Ссылки' }))
    expect(await screen.findByText('В этом чате пока нет ссылок.')).toBeInTheDocument()
  })

  it('поиск: запрос уходит после паузы, результаты списком; «Отмена» возвращает вкладки', async () => {
    vi.mocked(api.searchChatMessages).mockResolvedValue({ messages: [{ id: 's1', senderId: 'm2', text: 'купить молоко', createdAt: '2026-10-11T10:00:00Z' }], hasMore: false })
    renderPage('m2')
    await userEvent.click(await screen.findByRole('button', { name: 'Поиск сообщений' }))
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument()
    await userEvent.type(screen.getByLabelText('Поиск по сообщениям'), 'молоко')
    const list = await screen.findByRole('list', { name: 'Найденные сообщения' }, { timeout: 3000 })
    expect(within(list).getByText(/купить молоко/)).toBeInTheDocument()
    expect(api.searchChatMessages).toHaveBeenCalledWith('tok', 'm2', 'молоко', undefined)
    await userEvent.click(screen.getByRole('button', { name: 'Отмена' }))
    expect(await screen.findByRole('tablist')).toBeInTheDocument()
  })

  it('ничего не найдено: сообщение', async () => {
    renderPage('m2')
    await userEvent.click(await screen.findByRole('button', { name: 'Поиск сообщений' }))
    await userEvent.type(screen.getByLabelText('Поиск по сообщениям'), 'нету')
    expect(await screen.findByText('Ничего не найдено.', undefined, { timeout: 3000 })).toBeInTheDocument()
  })
})
