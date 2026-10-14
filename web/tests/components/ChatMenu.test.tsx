import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Provider } from 'react-redux'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as api from '@/api'
import type { ChatSummary, Member } from '@/api'
import { ChatsContext } from '@/chat/context'
import { ConfirmProvider } from '@/components/ConfirmDialog'
import { IdentityContext } from '@/identity/context'
import Chat from '@/pages/Chat'
import ChatRoom from '@/pages/ChatRoom'
import { ProfileContext } from '@/profile/context'
import { makeStore } from '@/store'
import { setSession } from '@/store/session'

vi.mock('@/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/api')>()),
  listMessages: vi.fn(),
  markChatRead: vi.fn(),
  setChatMuted: vi.fn(),
  clearChat: vi.fn(),
}))

const members: Member[] = [
  { id: 'me', name: 'Лена', role: 'mama', avatar: null, isOwner: true },
  { id: 'm2', name: 'Миша', role: 'child', avatar: null, isOwner: false },
]

function providers(children: React.ReactNode, opts: { chats?: ChatSummary[]; as?: 'me' | 'm2' } = {}) {
  const viewer = members.find((m) => m.id === (opts.as ?? 'me'))!
  const identity = { familyCode: 'c', memberId: viewer.id, name: viewer.name, role: viewer.role, token: 'tok' }
  const chats = opts.chats ?? [{ id: 'family', last: null, unread: 0 }, { id: viewer.id === 'me' ? 'm2' : 'me', last: null, unread: 0 }]
  return (
    <Provider store={makeStore({ hydrate: false })}>
      <IdentityContext.Provider value={{ identity, save: async () => {}, clear: async () => {} }}>
        <ProfileContext.Provider value={{ data: { me: { ...viewer, email: 'l@x.y' }, members }, failed: false }}>
          <ChatsContext.Provider value={{ chats, unread: 0 }}>
            <ConfirmProvider>{children}</ConfirmProvider>
          </ChatsContext.Provider>
        </ProfileContext.Provider>
      </IdentityContext.Provider>
    </Provider>
  )
}

function renderRoom(opts: { chat?: string; as?: 'me' | 'm2'; chats?: ChatSummary[] } = {}) {
  vi.mocked(api.listMessages).mockResolvedValue({ messages: [], hasMore: false, readUpTo: null, peer: null })
  window.scrollTo = vi.fn() as unknown as typeof window.scrollTo
  render(
    providers(
      <MemoryRouter initialEntries={[`/chat/${opts.chat ?? 'family'}`]}>
        <Routes><Route path="/chat/:chat" element={<ChatRoom />} /></Routes>
      </MemoryRouter>,
      opts,
    ),
  )
}

beforeEach(() => {
  setSession({ token: 'tok', memberId: 'me' })
  vi.mocked(api.markChatRead).mockReset().mockResolvedValue(undefined)
  vi.mocked(api.setChatMuted).mockReset().mockResolvedValue(undefined)
  vi.mocked(api.clearChat).mockReset().mockResolvedValue(undefined)
})
afterEach(cleanup)

describe('меню чата: три точки в переписке', () => {
  it('родитель: уведомления и очистка', async () => {
    renderRoom()
    await userEvent.click(await screen.findByRole('button', { name: 'Меню чата' }))
    expect(screen.getByRole('button', { name: 'Отключить уведомления' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Очистить чат' })).toBeInTheDocument()
  })

  it('ребёнок: только уведомления, очистки нет', async () => {
    renderRoom({ as: 'm2' })
    await userEvent.click(await screen.findByRole('button', { name: 'Меню чата' }))
    expect(screen.getByRole('button', { name: 'Отключить уведомления' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Очистить чат' })).not.toBeInTheDocument()
  })

  it('«Отключить уведомления» вызывает API и закрывает меню', async () => {
    renderRoom({ chat: 'm2' })
    await userEvent.click(await screen.findByRole('button', { name: 'Меню чата' }))
    await userEvent.click(screen.getByRole('button', { name: 'Отключить уведомления' }))
    await waitFor(() => expect(api.setChatMuted).toHaveBeenCalledWith('tok', 'm2', true))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('у отключённого чата пункт называется «Включить уведомления» и включает их, в шапке значок', async () => {
    renderRoom({ chats: [{ id: 'family', last: null, unread: 0, muted: true }] })
    expect(await screen.findByLabelText('Уведомления отключены')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Меню чата' }))
    await userEvent.click(screen.getByRole('button', { name: 'Включить уведомления' }))
    await waitFor(() => expect(api.setChatMuted).toHaveBeenCalledWith('tok', 'family', false))
  })

  it('очистка: сначала подтверждение, без него ничего не удаляется', async () => {
    renderRoom()
    await userEvent.click(await screen.findByRole('button', { name: 'Меню чата' }))
    await userEvent.click(screen.getByRole('button', { name: 'Очистить чат' }))
    expect(await screen.findByText(/удалены у всех участников/)).toBeInTheDocument()
    expect(api.clearChat).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: 'Отмена' }))
    expect(api.clearChat).not.toHaveBeenCalled()
  })

  it('очистка после подтверждения вызывает API для этого чата', async () => {
    renderRoom({ chat: 'm2' })
    await userEvent.click(await screen.findByRole('button', { name: 'Меню чата' }))
    await userEvent.click(screen.getByRole('button', { name: 'Очистить чат' }))
    expect(await screen.findByText(/Вся переписка с «Миша»/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Очистить' }))
    await waitFor(() => expect(api.clearChat).toHaveBeenCalledWith('tok', 'm2'))
  })

  it('ошибка сервера: меню остаётся открытым с сообщением', async () => {
    vi.mocked(api.setChatMuted).mockRejectedValue(new api.ApiError(500, 'internal_error'))
    renderRoom()
    await userEvent.click(await screen.findByRole('button', { name: 'Меню чата' }))
    await userEvent.click(screen.getByRole('button', { name: 'Отключить уведомления' }))
    expect(await screen.findByText(/Не удалось выполнить действие/)).toBeInTheDocument()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('двойное нажатие на пункт выполняет действие один раз', async () => {
    renderRoom()
    await userEvent.click(await screen.findByRole('button', { name: 'Меню чата' }))
    const item = screen.getByRole('button', { name: 'Отключить уведомления' })
    await act(async () => {
      fireEvent.click(item)
      fireEvent.click(item)
    })
    await waitFor(() => expect(api.setChatMuted).toHaveBeenCalledTimes(1))
  })

  it('Escape закрывает меню', async () => {
    renderRoom()
    await userEvent.click(await screen.findByRole('button', { name: 'Меню чата' }))
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})

describe('меню чата: долгое нажатие в списке', () => {
  const chats: ChatSummary[] = [
    { id: 'family', last: null, unread: 0 },
    { id: 'm2', last: null, unread: 3, muted: true },
  ]
  const renderList = (as: 'me' | 'm2' = 'me') =>
    render(providers(<MemoryRouter><Chat /></MemoryRouter>, { chats: as === 'me' ? chats : [{ id: 'family', last: null, unread: 0 }, { id: 'me', last: null, unread: 0 }], as }))

  it('удержание строки открывает меню этого чата, обычное нажатие остаётся переходом', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      renderList()
      const row = screen.getByRole('link', { name: /Общий чат/ })
      fireEvent.pointerDown(row, { pointerType: 'touch', clientX: 10, clientY: 10, button: 0 })
      await act(async () => { await vi.advanceTimersByTimeAsync(200) })
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      await act(async () => { await vi.advanceTimersByTimeAsync(300) })
      expect(screen.getByRole('dialog', { name: 'Общий чат' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Отключить уведомления' })).toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })

  it('правая кнопка мыши открывает то же меню; у отключённого чата «Включить»', async () => {
    renderList()
    fireEvent.contextMenu(screen.getByRole('link', { name: /Миша/ }))
    expect(await screen.findByRole('button', { name: 'Включить уведомления' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Очистить чат' })).toBeInTheDocument()
  })

  it('отключённый чат помечен значком, счётчик остаётся', () => {
    renderList()
    expect(screen.getByLabelText('Уведомления отключены')).toBeInTheDocument()
    expect(screen.getByLabelText('Непрочитанных: 3')).toBeInTheDocument()
  })

  it('ребёнку в списке доступно только отключение уведомлений', () => {
    renderList('m2')
    fireEvent.contextMenu(screen.getByRole('link', { name: /Общий чат/ }))
    expect(screen.getByRole('button', { name: 'Отключить уведомления' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Очистить чат' })).not.toBeInTheDocument()
  })
})
