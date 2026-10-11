import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as api from '@/api'
import type { ChatMessage, ChatSummary, Member } from '@/api'
import { ChatsContext } from '@/chat/context'
import { TabBar } from '@/components/TabBar'
import { IdentityContext } from '@/identity/context'
import Chat from '@/pages/Chat'
import ChatRoom from '@/pages/ChatRoom'
import { Composer } from '@/pages/ChatRoom/components/Composer'
import { ProfileContext } from '@/profile/context'
import { RealtimeContext } from '@/realtime/context'
import type { Listener } from '@/realtime/types'

vi.mock('@/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/api')>()),
  listMessages: vi.fn(),
  sendMessage: vi.fn(),
  markChatRead: vi.fn(),
}))

const members: Member[] = [
  { id: 'me', name: 'Лена', role: 'mama', avatar: null, isOwner: true },
  { id: 'm2', name: 'Миша', role: 'child', avatar: null, isOwner: false },
]
const m = (id: string, senderId: string, text: string, createdAt = '2026-10-11T10:00:00Z'): ChatMessage => ({ id, senderId, text, createdAt })

function providers(children: React.ReactNode, opts: { chats?: ChatSummary[]; refresh?: () => Promise<void> } = {}) {
  const identity = { familyCode: 'c', memberId: 'me', name: 'Лена', role: 'mama' as const, token: 'tok' }
  const chats = opts.chats ?? []
  return (
    <IdentityContext.Provider value={{ identity, save: async () => {}, clear: async () => {} }}>
      <ProfileContext.Provider value={{ data: { me: { ...members[0], email: 'l@x.y' }, members }, failed: false, refresh: async () => {} }}>
        <ChatsContext.Provider value={{ chats, unread: chats.reduce((s, c) => s + c.unread, 0), refresh: opts.refresh ?? (async () => {}) }}>
          {children}
        </ChatsContext.Provider>
      </ProfileContext.Provider>
    </IdentityContext.Provider>
  )
}

beforeEach(() => {
  vi.mocked(api.listMessages).mockReset()
  vi.mocked(api.sendMessage).mockReset()
  vi.mocked(api.markChatRead).mockReset().mockResolvedValue(undefined)
})

describe('список чатов', () => {
  const chats: ChatSummary[] = [
    { id: 'm2', last: m('1', 'm2', 'мам, привет'), unread: 2 },
    { id: 'family', last: m('2', 'me', 'всем ужин'), unread: 0 },
    { id: 'empty', last: null, unread: 0 },
  ]

  it('показывает чаты в полученном порядке, превью, счётчик непрочитанного и ссылки', () => {
    render(providers(<MemoryRouter><Chat /></MemoryRouter>, { chats }))
    const links = screen.getAllByRole('link')
    expect(links.map((l) => l.getAttribute('href'))).toEqual(['/chat/m2', '/chat/family', '/chat/empty'])
    expect(links[0]).toHaveTextContent('Миша')
    expect(links[0]).toHaveTextContent('мам, привет')
    expect(screen.getByLabelText('Непрочитанных: 2')).toHaveTextContent('2')
    expect(links[1]).toHaveTextContent('Общий чат')
    expect(links[1]).toHaveTextContent('Вы: всем ужин')
    expect(links[2]).toHaveTextContent('Сообщений пока нет')
  })
})

describe('значок на табе «Чат»', () => {
  const renderBar = (unread: number) =>
    render(
      <ChatsContext.Provider value={{ chats: [], unread, refresh: async () => {} }}>
        <MemoryRouter><TabBar /></MemoryRouter>
      </ChatsContext.Provider>,
    )

  it('показывает число непрочитанных', () => {
    renderBar(3)
    expect(screen.getByLabelText('Непрочитанных сообщений: 3')).toHaveTextContent('3')
  })
  it('99+ при большом числе, нет значка при нуле', () => {
    const { unmount } = renderBar(250)
    expect(screen.getByLabelText(/Непрочитанных сообщений/)).toHaveTextContent('99+')
    unmount()
    renderBar(0)
    expect(screen.queryByLabelText(/Непрочитанных сообщений/)).not.toBeInTheDocument()
  })
})

describe('Composer', () => {
  it('Enter отправляет, поле очищается; Shift+Enter переносит строку', async () => {
    const onSend = vi.fn().mockResolvedValue(undefined)
    const user = userEvent.setup()
    render(<Composer onSend={onSend} />)
    const field = screen.getByLabelText('Сообщение')
    await user.type(field, 'первая{Shift>}{Enter}{/Shift}вторая')
    expect(onSend).not.toHaveBeenCalled()
    await user.keyboard('{Enter}')
    expect(onSend).toHaveBeenCalledWith('первая\nвторая')
    await waitFor(() => expect(field).toHaveValue(''))
  })

  it('пока пусто, отправить нельзя', async () => {
    const onSend = vi.fn()
    const user = userEvent.setup()
    render(<Composer onSend={onSend} />)
    expect(screen.getByRole('button', { name: 'Отправить' })).toBeDisabled()
    await user.type(screen.getByLabelText('Сообщение'), '   {Enter}')
    expect(onSend).not.toHaveBeenCalled()
  })

  it('при ошибке текст остаётся и показано сообщение', async () => {
    const onSend = vi.fn().mockRejectedValue(new Error('x'))
    const user = userEvent.setup()
    render(<Composer onSend={onSend} />)
    await user.type(screen.getByLabelText('Сообщение'), 'привет{Enter}')
    expect(await screen.findByText(/Не удалось отправить сообщение/)).toBeInTheDocument()
    expect(screen.getByLabelText('Сообщение')).toHaveValue('привет')
  })
})

describe('переписка', () => {
  const renderRoom = (chat = 'family', refresh = vi.fn().mockResolvedValue(undefined)) => {
    render(
      providers(
        <MemoryRouter initialEntries={[`/chat/${chat}`]}>
          <Routes>
            <Route path="/chat/:chat" element={<ChatRoom />} />
            <Route path="/chat" element={<p>Список чатов</p>} />
          </Routes>
        </MemoryRouter>,
        { refresh },
      ),
    )
    return { refresh }
  }

  beforeEach(() => {
    window.scrollTo = vi.fn() as unknown as typeof window.scrollTo
  })

  it('общий чат: имена авторов у чужих сообщений, свои без имени', async () => {
    vi.mocked(api.listMessages).mockResolvedValue({ messages: [m('1', 'm2', 'я дома'), m('2', 'me', 'молодец')], hasMore: false, readUpTo: null })
    renderRoom('family')
    expect(await screen.findByText('я дома')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Общий чат' })).toBeInTheDocument()
    expect(screen.getByText('Миша')).toBeInTheDocument()
    expect(screen.queryByText('Лена')).not.toBeInTheDocument()
    expect(api.listMessages).toHaveBeenCalledWith('tok', 'family')
  })

  it('свои сообщения с галочками: «прочитано» до отметки собеседника, «отправлено» после; у чужих галочек нет', async () => {
    vi.mocked(api.listMessages).mockResolvedValue({
      messages: [
        m('1', 'me', 'прочитано', '2026-10-11T10:00:00Z'),
        m('2', 'me', 'ещё нет', '2026-10-11T11:00:00Z'),
        m('3', 'm2', 'от собеседника', '2026-10-11T11:30:00Z'),
      ],
      hasMore: false,
      readUpTo: '2026-10-11T10:30:00Z',
    })
    renderRoom('m2')
    await screen.findByText('прочитано')
    expect(screen.getAllByRole('img', { name: 'Прочитано' })).toHaveLength(1)
    expect(screen.getAllByRole('img', { name: 'Отправлено' })).toHaveLength(1)
    expect(screen.getByText('от собеседника').closest('div')?.parentElement?.querySelector('[role=img]')).toBeNull()
  })

  it('личный чат: заголовок по собеседнику, имён над сообщениями нет', async () => {
    vi.mocked(api.listMessages).mockResolvedValue({ messages: [m('1', 'm2', 'привет')], hasMore: false, readUpTo: null })
    renderRoom('m2')
    expect(await screen.findByText('привет')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Миша' })).toBeInTheDocument()
    expect(screen.queryByText('Миша', { selector: 'div' })).not.toBeInTheDocument()
  })

  it('отмечает прочитанным, если есть чужие сообщения, и только один раз', async () => {
    vi.mocked(api.listMessages).mockResolvedValue({ messages: [m('1', 'm2', 'привет')], hasMore: false, readUpTo: null })
    const { refresh } = renderRoom('m2')
    await screen.findByText('привет')
    await waitFor(() => expect(api.markChatRead).toHaveBeenCalledWith('tok', 'm2'))
    await waitFor(() => expect(refresh).toHaveBeenCalled())
    expect(api.markChatRead).toHaveBeenCalledTimes(1)
  })

  it('сигнал сокета обновляет переписку, но повторной отметки о прочтении нет (иначе бесконечный цикл)', async () => {
    const listeners = new Set<Listener>()
    vi.mocked(api.listMessages).mockResolvedValue({ messages: [m('1', 'm2', 'привет')], hasMore: false, readUpTo: null })
    render(
      <RealtimeContext.Provider value={{ subscribe: (l) => (listeners.add(l), () => void listeners.delete(l)) }}>
        {providers(
          <MemoryRouter initialEntries={['/chat/m2']}>
            <Routes><Route path="/chat/:chat" element={<ChatRoom />} /></Routes>
          </MemoryRouter>,
        )}
      </RealtimeContext.Provider>,
    )
    await screen.findByText('привет')
    await waitFor(() => expect(api.markChatRead).toHaveBeenCalledTimes(1))

    // событие другого чата не трогает эту переписку
    act(() => listeners.forEach((l) => l({ type: 'chat', chat: 'family' })))
    expect(api.listMessages).toHaveBeenCalledTimes(1)

    // событие этого чата: сообщения запрашиваются заново, новых чужих нет, отметка не повторяется
    act(() => listeners.forEach((l) => l({ type: 'chat', chat: 'm2' })))
    await waitFor(() => expect(api.listMessages).toHaveBeenCalledTimes(2))
    await new Promise((r) => setTimeout(r, 30))
    expect(api.markChatRead).toHaveBeenCalledTimes(1)

    // пришло новое чужое сообщение: отметка нужна снова
    vi.mocked(api.listMessages).mockResolvedValue({ messages: [m('1', 'm2', 'привет'), m('2', 'm2', 'ещё')], hasMore: false, readUpTo: null })
    act(() => listeners.forEach((l) => l({ type: 'chat', chat: 'm2' })))
    await screen.findByText('ещё')
    await waitFor(() => expect(api.markChatRead).toHaveBeenCalledTimes(2))
  })

  it('в чате одни свои сообщения: отметка не нужна', async () => {
    vi.mocked(api.listMessages).mockResolvedValue({ messages: [m('1', 'me', 'сам себе')], hasMore: false, readUpTo: null })
    renderRoom('m2')
    await screen.findByText('сам себе')
    expect(api.markChatRead).not.toHaveBeenCalled()
  })

  it('пустой чат подсказывает написать первым', async () => {
    vi.mocked(api.listMessages).mockResolvedValue({ messages: [], hasMore: false, readUpTo: null })
    renderRoom('m2')
    expect(await screen.findByText(/Напишите первым/)).toBeInTheDocument()
  })

  it('отправка: сообщение появляется сразу, список чатов обновляется', async () => {
    vi.mocked(api.listMessages).mockResolvedValue({ messages: [], hasMore: false, readUpTo: null })
    vi.mocked(api.sendMessage).mockResolvedValue({ message: m('9', 'me', 'всем привет') })
    const { refresh } = renderRoom('family')
    const user = userEvent.setup()
    await user.type(await screen.findByLabelText('Сообщение'), 'всем привет{Enter}')
    expect(api.sendMessage).toHaveBeenCalledWith('tok', 'family', 'всем привет')
    expect(await screen.findByText('всем привет')).toBeInTheDocument()
    await waitFor(() => expect(refresh).toHaveBeenCalled())
  })

  it('более ранние сообщения подгружаются по кнопке и встают сверху', async () => {
    vi.mocked(api.listMessages)
      .mockResolvedValueOnce({ messages: [m('5', 'me', 'новое')], hasMore: true, readUpTo: null })
      .mockResolvedValueOnce({ messages: [m('1', 'me', 'старое')], hasMore: false, readUpTo: null })
    renderRoom('m2')
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: 'Показать более ранние' }))
    expect(api.listMessages).toHaveBeenLastCalledWith('tok', 'm2', '5')
    const texts = (await screen.findAllByText(/старое|новое/)).map((e) => e.textContent)
    expect(texts).toEqual(['старое', 'новое'])
    expect(screen.queryByRole('button', { name: 'Показать более ранние' })).not.toBeInTheDocument()
  })

  it('неизвестный чат ведёт к списку', async () => {
    vi.mocked(api.listMessages).mockRejectedValue(new api.ApiError(404, 'chat_not_found'))
    renderRoom('zzz')
    expect(await screen.findByText('Список чатов')).toBeInTheDocument()
  })

  it('ошибка загрузки показывается', async () => {
    vi.mocked(api.listMessages).mockRejectedValue(new api.ApiError(500, 'x'))
    renderRoom('family')
    expect(await screen.findByText(/Не удалось загрузить сообщения/)).toBeInTheDocument()
  })
})
