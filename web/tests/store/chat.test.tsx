import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Provider } from 'react-redux'
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as api from '@/api'
import type { ChatMessage, ChatSummary, Member } from '@/api'
import { ChatsProvider } from '@/chat'
import { useChats } from '@/chat/context'
import { IdentityContext } from '@/identity/context'
import ChatRoom from '@/pages/ChatRoom'
import { ProfileContext } from '@/profile/context'
import { makeStore } from '@/store'
import { ownerChanged } from '@/store/cache'
import { chatApi } from '@/store/chat'
import { saveCache } from '@/store/persist'
import { setSession } from '@/store/session'

vi.mock('@/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/api')>()),
  listChats: vi.fn(),
  listMessages: vi.fn(),
  sendMessage: vi.fn(),
  markChatRead: vi.fn(),
}))

const mama: Member = { id: 'me', name: 'Лена', role: 'mama', avatar: null, isOwner: true }
const kid: Member = { id: 'm2', name: 'Миша', role: 'child', avatar: null, isOwner: false }
const identity = { familyCode: 'c', memberId: 'me', name: 'Лена', role: 'mama' as const, token: 'tok' }
const msg = (id: string, senderId: string, text: string): ChatMessage => ({ id, senderId, text, caption: text, media: [], createdAt: '2026-10-11T10:00:00Z', reactions: [], awards: [] })
const page = (messages: ChatMessage[]) => ({ messages, hasMore: false, readUpTo: null, peer: null })

function Unread() {
  return <p data-testid="unread">{useChats().unread}</p>
}

function Nav() {
  const navigate = useNavigate()
  return <button onClick={() => navigate('/chat/family')}>to-family</button>
}

function Shell({ store }: { store: ReturnType<typeof makeStore> }) {
  return (
    <Provider store={store}>
      <IdentityContext.Provider value={{ identity, save: async () => {}, clear: async () => {} }}>
        <ProfileContext.Provider value={{ data: { me: { ...mama, email: 'x@y.z' }, members: [mama, kid] }, failed: false }}>
          <ChatsProvider>
            <MemoryRouter initialEntries={['/chat/m2']}>
              <Unread />
              <Nav />
              <Routes><Route path="/chat/:chat" element={<ChatRoom />} /></Routes>
            </MemoryRouter>
          </ChatsProvider>
        </ProfileContext.Provider>
      </IdentityContext.Provider>
    </Provider>
  )
}

beforeEach(() => {
  localStorage.clear()
  window.scrollTo = vi.fn() as unknown as typeof window.scrollTo
  setSession({ token: 'tok', memberId: 'me' })
  const chats: ChatSummary[] = [{ id: 'm2', last: msg('1', 'm2', 'привет'), unread: 1 }]
  vi.mocked(api.listChats).mockReset().mockResolvedValue({ chats })
  vi.mocked(api.listMessages).mockReset().mockImplementation(async (_t, chat) => page(chat === 'family' ? [msg('f1', 'm2', 'общий привет')] : [msg('1', 'm2', 'привет')]))
  vi.mocked(api.sendMessage).mockReset()
  vi.mocked(api.markChatRead).mockReset().mockResolvedValue(undefined)
})

describe('чат через кэш', () => {
  it('после перезапуска переписка и непрочитанное видны на первом кадре, пока свежее ещё грузится', async () => {
    const old = makeStore({ hydrate: false })
    const a = old.dispatch(chatApi.endpoints.getMessages.initiate('m2'))
    const b = old.dispatch(chatApi.endpoints.listChats.initiate())
    await Promise.all([a, b])
    old.dispatch(ownerChanged('me'))
    const state = old.getState().api
    // состарим записи, чтобы при открытии экраны запросили свежее
    const queries = Object.fromEntries(Object.entries(state.queries).map(([k, q]) => [k, { ...q!, fulfilledTimeStamp: Date.now() - 120_000 }]))
    saveCache('me', { queries, provided: state.provided })
    a.unsubscribe()
    b.unsubscribe()

    vi.mocked(api.listMessages).mockImplementation(() => new Promise(() => {}))
    vi.mocked(api.listChats).mockImplementation(() => new Promise(() => {}))
    render(<Shell store={makeStore()} />)
    expect(screen.getByText('привет')).toBeInTheDocument()
    expect(screen.queryByText('Загрузка…')).not.toBeInTheDocument()
    expect(screen.getByTestId('unread')).toHaveTextContent('1')
  })

  it('открыли чат: отметка «прочитано» обновляет список чатов (непрочитанное исчезает)', async () => {
    // сервер после отметки отдаёт список без непрочитанного
    vi.mocked(api.markChatRead).mockImplementation(async () => {
      vi.mocked(api.listChats).mockResolvedValue({ chats: [{ id: 'm2', last: msg('1', 'm2', 'привет'), unread: 0 }] })
    })
    render(<Shell store={makeStore({ hydrate: false })} />)
    await waitFor(() => expect(screen.getByTestId('unread')).toHaveTextContent('1'))
    await waitFor(() => expect(api.markChatRead).toHaveBeenCalledWith('tok', 'm2'))
    await waitFor(() => expect(screen.getByTestId('unread')).toHaveTextContent('0'))
  })

  it('отправка: сообщение сразу в переписке и в кэше, список чатов обновляется', async () => {
    vi.mocked(api.sendMessage).mockResolvedValue({ message: msg('9', 'me', 'как дела') })
    const store = makeStore({ hydrate: false })
    render(<Shell store={store} />)
    await screen.findByText('привет')
    const listCalls = vi.mocked(api.listChats).mock.calls.length
    await userEvent.type(screen.getByLabelText('Сообщение'), 'как дела{Enter}')
    expect(await screen.findByText('как дела')).toBeInTheDocument()
    expect(api.sendMessage).toHaveBeenCalledWith('tok', 'm2', 'как дела')
    expect(chatApi.endpoints.getMessages.select('m2')(store.getState()).data?.messages.map((m) => m.id)).toContain('9')
    await waitFor(() => expect(vi.mocked(api.listChats).mock.calls.length).toBeGreaterThan(listCalls))
  })

  it('переход в другой чат начинается с чистого листа: старой переписки на экране нет', async () => {
    render(<Shell store={makeStore({ hydrate: false })} />)
    await screen.findByText('привет')
    await act(async () => screen.getByText('to-family').click())
    await screen.findByText('общий привет')
    expect(screen.queryByText('привет', { exact: true })).not.toBeInTheDocument()
  })
})
