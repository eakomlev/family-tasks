import { act, render, screen, waitFor, within } from '@testing-library/react'
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
  giveFeedback: vi.fn(),
  listMessages: vi.fn(),
  sendMessage: vi.fn(),
  markChatRead: vi.fn(),
}))

const members: Member[] = [
  { id: 'me', name: 'Лена', role: 'mama', avatar: null, isOwner: true },
  { id: 'm2', name: 'Миша', role: 'child', avatar: null, isOwner: false },
]
const m = (id: string, senderId: string, text: string, createdAt = '2026-10-11T10:00:00Z'): ChatMessage => ({ id, senderId, text, createdAt, reactions: [], awards: [] })

function providers(children: React.ReactNode, opts: { chats?: ChatSummary[]; refresh?: () => Promise<void>; as?: 'me' | 'm2' } = {}) {
  // по умолчанию смотрит мама (me), опционально ребёнок (m2)
  const viewer = members.find((m) => m.id === (opts.as ?? 'me'))!
  const identity = { familyCode: 'c', memberId: viewer.id, name: viewer.name, role: viewer.role, token: 'tok' }
  const chats = opts.chats ?? []
  return (
    <IdentityContext.Provider value={{ identity, save: async () => {}, clear: async () => {} }}>
      <ProfileContext.Provider value={{ data: { me: { ...viewer, email: 'l@x.y' }, members }, failed: false, refresh: async () => {} }}>
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

describe('ребёнок видит родителей как «Мама» и «Папа»', () => {
  it('в списке чатов: название, превью в общем чате и аватар по роли', () => {
    const chats: ChatSummary[] = [
      { id: 'me', last: m('1', 'me', 'ты где?'), unread: 1 },
      { id: 'family', last: m('2', 'me', 'ужин готов'), unread: 0 },
    ]
    render(providers(<MemoryRouter><Chat /></MemoryRouter>, { chats, as: 'm2' }))
    const links = screen.getAllByRole('link')
    expect(links[0]).toHaveTextContent('Мама')
    expect(links[0]).not.toHaveTextContent('Лена')
    expect(links[1]).toHaveTextContent('Мама: ужин готов')
    expect(screen.queryByText(/Лена/)).not.toBeInTheDocument()
  })

  it('у родителя те же чаты называются по имени', () => {
    const chats: ChatSummary[] = [{ id: 'm2', last: m('1', 'm2', 'я дома'), unread: 0 }]
    render(providers(<MemoryRouter><Chat /></MemoryRouter>, { chats, as: 'me' }))
    expect(screen.getByRole('link')).toHaveTextContent('Миша')
  })

  it('в переписке: заголовок личного чата и подпись автора в общем', async () => {
    vi.mocked(api.listMessages).mockResolvedValue({ messages: [m('1', 'me', 'привет всем')], hasMore: false, readUpTo: null, peer: null })
    window.scrollTo = vi.fn() as unknown as typeof window.scrollTo
    const view = (chat: string) =>
      render(
        providers(
          <MemoryRouter initialEntries={[`/chat/${chat}`]}>
            <Routes><Route path="/chat/:chat" element={<ChatRoom />} /></Routes>
          </MemoryRouter>,
          { as: 'm2' },
        ),
      )
    const family = view('family')
    await screen.findByText('привет всем')
    expect(screen.getByText('Мама')).toBeInTheDocument()
    expect(screen.queryByText('Лена')).not.toBeInTheDocument()
    family.unmount()

    view('me')
    expect(await screen.findByRole('heading', { name: 'Мама' })).toBeInTheDocument()
  })
})

describe('реакции и монеты под сообщениями', () => {
  const kidMessage = { ...m('1', 'm2', 'Получил пятёрку!'), reactions: [{ memberId: 'me', emoji: '👏' }], awards: [{ amount: 20, by: 'me' }, { amount: 5, by: 'me' }] }

  function renderRoom(as: 'me' | 'm2', messages: ChatMessage[], chat = 'family') {
    vi.mocked(api.listMessages).mockResolvedValue({ messages, hasMore: false, readUpTo: null, peer: null })
    window.scrollTo = vi.fn() as unknown as typeof window.scrollTo
    render(
      providers(
        <MemoryRouter initialEntries={[`/chat/${chat}`]}>
          <Routes><Route path="/chat/:chat" element={<ChatRoom />} /></Routes>
        </MemoryRouter>,
        { as },
      ),
    )
  }

  it('реакции и сумма монет видны под сообщением всем', async () => {
    renderRoom('m2', [kidMessage])
    await screen.findByText('Получил пятёрку!')
    const extras = screen.getByLabelText('Реакции и монеты')
    expect(within(extras).getByLabelText('Реакция 👏')).toBeInTheDocument()
    expect(within(extras).getByLabelText('Начислено монет: 25')).toHaveTextContent('+25')
  })

  it('одинаковые реакции склеиваются с числом', async () => {
    renderRoom('m2', [{ ...m('1', 'm2', 'Привет'), reactions: [{ memberId: 'me', emoji: '👍' }, { memberId: 'papa', emoji: '👍' }] }])
    await screen.findByText('Привет')
    expect(screen.getByLabelText('Реакция 👍, 2')).toHaveTextContent('2')
  })

  it('без реакций и монет блока под сообщением нет', async () => {
    renderRoom('m2', [m('1', 'm2', 'Просто текст')])
    await screen.findByText('Просто текст')
    expect(screen.queryByLabelText('Реакции и монеты')).not.toBeInTheDocument()
  })

  it('родитель нажимает на сообщение ребёнка: открывается окно, выбор уходит на сервер, под сообщением обновляется', async () => {
    renderRoom('me', [m('1', 'm2', 'Сдал контрольную')])
    const updated = { ...m('1', 'm2', 'Сдал контрольную'), reactions: [{ memberId: 'me', emoji: '🔥' }], awards: [{ amount: 30, by: 'me' }] }
    vi.mocked(api.giveFeedback).mockResolvedValue({ message: updated })
    const user = userEvent.setup()

    await user.click(await screen.findByRole('button', { name: /Сдал контрольную/ }))
    const dialog = screen.getByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Реакция 🔥' }))
    await user.click(within(dialog).getByRole('button', { name: '20' }))
    await user.click(within(dialog).getByRole('button', { name: 'Другая' }))
    await user.type(within(dialog).getByLabelText('Своя награда, монет'), '30')
    await user.click(within(dialog).getByRole('button', { name: 'Отправить' }))

    expect(api.giveFeedback).toHaveBeenCalledWith('tok', 'family', '1', { emoji: '🔥', coins: 30 })
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(await screen.findByLabelText('Начислено монет: 30')).toBeInTheDocument()
    expect(screen.getByLabelText('Реакция 🔥')).toBeInTheDocument()
  })

  it('моя прежняя реакция в окне уже выбрана', async () => {
    renderRoom('me', [kidMessage])
    await userEvent.click(await screen.findByRole('button', { name: /Получил пятёрку/ }))
    expect(within(screen.getByRole('dialog')).getByRole('button', { name: 'Реакция 👏' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('работает и в личном чате с ребёнком', async () => {
    renderRoom('me', [m('1', 'm2', 'Мам, смотри')], 'm2')
    await userEvent.click(await screen.findByRole('button', { name: /Мам, смотри/ }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('на сообщения взрослых и свои у родителя реакцию поставить можно, а монет нет', async () => {
    renderRoom('me', [m('1', 'me', 'Моё сообщение'), m('2', 'papa', 'Сообщение папы')])
    await userEvent.click(await screen.findByRole('button', { name: /Сообщение папы/ }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Реакция 👍' })).toBeInTheDocument()
    expect(screen.queryByText('Начислить монеты')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Моё сообщение/ })).toBeInTheDocument()
  })

  it('ребёнок может поставить реакцию на любое сообщение, но монет у него нет', async () => {
    renderRoom('m2', [m('1', 'm2', 'Своё'), m('2', 'me', 'От мамы')])
    await userEvent.click(await screen.findByRole('button', { name: /От мамы/ }))
    expect(screen.getByRole('button', { name: 'Реакция 👍' })).toBeInTheDocument()
    expect(screen.queryByText('Начислить монеты')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Своё/ })).toBeInTheDocument()
  })

  it('нажатие с клавиатуры (Enter) тоже открывает окно', async () => {
    renderRoom('me', [m('1', 'm2', 'С клавиатуры')])
    const bubble = await screen.findByRole('button', { name: /С клавиатуры/ })
    bubble.focus()
    await userEvent.keyboard('{Enter}')
    expect(screen.getByRole('dialog')).toBeInTheDocument()
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
    vi.mocked(api.listMessages).mockResolvedValue({ messages: [m('1', 'm2', 'я дома'), m('2', 'me', 'молодец')], hasMore: false, readUpTo: null, peer: null })
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
      readUpTo: '2026-10-11T10:30:00Z', peer: null,
    })
    renderRoom('m2')
    await screen.findByText('прочитано')
    expect(screen.getAllByRole('img', { name: 'Прочитано' })).toHaveLength(1)
    expect(screen.getAllByRole('img', { name: 'Отправлено' })).toHaveLength(1)
    expect(screen.getByText('от собеседника').closest('div')?.parentElement?.querySelector('[role=img]')).toBeNull()
  })

  it('личный чат: заголовок по собеседнику, имён над сообщениями нет', async () => {
    vi.mocked(api.listMessages).mockResolvedValue({ messages: [m('1', 'm2', 'привет')], hasMore: false, readUpTo: null, peer: null })
    renderRoom('m2')
    expect(await screen.findByText('привет')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Миша' })).toBeInTheDocument()
    expect(screen.queryByText('Миша', { selector: 'div' })).not.toBeInTheDocument()
  })

  it('отмечает прочитанным, если есть чужие сообщения, и только один раз', async () => {
    vi.mocked(api.listMessages).mockResolvedValue({ messages: [m('1', 'm2', 'привет')], hasMore: false, readUpTo: null, peer: null })
    const { refresh } = renderRoom('m2')
    await screen.findByText('привет')
    await waitFor(() => expect(api.markChatRead).toHaveBeenCalledWith('tok', 'm2'))
    await waitFor(() => expect(refresh).toHaveBeenCalled())
    expect(api.markChatRead).toHaveBeenCalledTimes(1)
  })

  it('сигнал сокета обновляет переписку, но повторной отметки о прочтении нет (иначе бесконечный цикл)', async () => {
    const listeners = new Set<Listener>()
    vi.mocked(api.listMessages).mockResolvedValue({ messages: [m('1', 'm2', 'привет')], hasMore: false, readUpTo: null, peer: null })
    render(
      <RealtimeContext.Provider value={{ subscribe: (l) => (listeners.add(l), () => void listeners.delete(l)), setViewing: () => {} }}>
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
    vi.mocked(api.listMessages).mockResolvedValue({ messages: [m('1', 'm2', 'привет'), m('2', 'm2', 'ещё')], hasMore: false, readUpTo: null, peer: null })
    act(() => listeners.forEach((l) => l({ type: 'chat', chat: 'm2' })))
    await screen.findByText('ещё')
    await waitFor(() => expect(api.markChatRead).toHaveBeenCalledTimes(2))
  })

  it('в чате одни свои сообщения: отметка не нужна', async () => {
    vi.mocked(api.listMessages).mockResolvedValue({ messages: [m('1', 'me', 'сам себе')], hasMore: false, readUpTo: null, peer: null })
    renderRoom('m2')
    await screen.findByText('сам себе')
    expect(api.markChatRead).not.toHaveBeenCalled()
  })

  it('пустой чат подсказывает написать первым', async () => {
    vi.mocked(api.listMessages).mockResolvedValue({ messages: [], hasMore: false, readUpTo: null, peer: null })
    renderRoom('m2')
    expect(await screen.findByText(/Напишите первым/)).toBeInTheDocument()
  })

  it('отправка: сообщение появляется сразу, список чатов обновляется', async () => {
    vi.mocked(api.listMessages).mockResolvedValue({ messages: [], hasMore: false, readUpTo: null, peer: null })
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
      .mockResolvedValueOnce({ messages: [m('5', 'me', 'новое')], hasMore: true, readUpTo: null, peer: null })
      .mockResolvedValueOnce({ messages: [m('1', 'me', 'старое')], hasMore: false, readUpTo: null, peer: null })
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

describe('длинное последнее сообщение в списке чатов', () => {
  it('превью одной строкой с многоточием; колонка списка не растёт под текст', () => {
    const long = 'Очень-длинное-сообщение-без-пробелов-' + 'я'.repeat(300)
    const chats: ChatSummary[] = [{ id: 'm2', last: m('1', 'm2', long), unread: 0 }]
    render(providers(<MemoryRouter><Chat /></MemoryRouter>, { chats }))
    const list = screen.getByRole('list')
    // jsdom не считает вёрстку, поэтому проверяем сами правила: одна колонка minmax(0, 1fr) и обрезка превью
    expect(getComputedStyle(list).gridTemplateColumns).toBe('minmax(0, 1fr)')
    const preview = screen.getByText(/Очень-длинное/)
    expect(getComputedStyle(preview).whiteSpace).toBe('nowrap')
    expect(getComputedStyle(preview).textOverflow).toBe('ellipsis')
  })
})
