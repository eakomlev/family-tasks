import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Provider } from 'react-redux'
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
import { makeStore } from '@/store'
import { RealtimeBridge } from '@/store/RealtimeBridge'
import { setSession } from '@/store/session'

vi.mock('@/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/api')>()),
  giveFeedback: vi.fn(),
  listMessages: vi.fn(),
  sendMessage: vi.fn(),
  uploadChatPhoto: vi.fn(),
  markChatRead: vi.fn(),
}))
vi.mock('@/lib/image', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/image')>()),
  resizeToPhoto: vi.fn(async () => ({ blob: new Blob(['x'], { type: 'image/jpeg' }), width: 800, height: 600 })),
}))

const members: Member[] = [
  { id: 'me', name: 'Лена', role: 'mama', avatar: null, isOwner: true },
  { id: 'm2', name: 'Миша', role: 'child', avatar: null, isOwner: false },
]
const m = (id: string, senderId: string, text: string, createdAt = '2026-10-11T10:00:00Z'): ChatMessage => ({ id, senderId, text, caption: text, media: [], createdAt, reactions: [], awards: [] })

function providers(children: React.ReactNode, opts: { chats?: ChatSummary[]; as?: 'me' | 'm2' } = {}) {
  // по умолчанию смотрит мама (me), опционально ребёнок (m2)
  const viewer = members.find((m) => m.id === (opts.as ?? 'me'))!
  const identity = { familyCode: 'c', memberId: viewer.id, name: viewer.name, role: viewer.role, token: 'tok' }
  const chats = opts.chats ?? []
  return (
    <Provider store={makeStore({ hydrate: false })}>
      <IdentityContext.Provider value={{ identity, save: async () => {}, clear: async () => {} }}>
        <ProfileContext.Provider value={{ data: { me: { ...viewer, email: 'l@x.y' }, members }, failed: false }}>
          <ChatsContext.Provider value={{ chats, unread: chats.reduce((s, c) => s + c.unread, 0) }}>
            {children}
          </ChatsContext.Provider>
        </ProfileContext.Provider>
      </IdentityContext.Provider>
    </Provider>
  )
}

beforeEach(() => {
  setSession({ token: 'tok', memberId: 'me' })
  vi.mocked(api.listMessages).mockReset()
  vi.mocked(api.sendMessage).mockReset()
  vi.mocked(api.markChatRead).mockReset().mockResolvedValue(undefined)
})

describe('список чатов: загрузка', () => {
  it('пока список грузится, вместо него серые строки, а не пустой экран', () => {
    render(
      <Provider store={makeStore({ hydrate: false })}>
        <IdentityContext.Provider value={{ identity: { familyCode: 'c', memberId: 'me', name: 'Лена', role: 'mama', token: 'tok' }, save: async () => {}, clear: async () => {} }}>
          <ProfileContext.Provider value={{ data: { me: { ...members[0], email: 'l@x.y' }, members }, failed: false }}>
            <ChatsContext.Provider value={{ chats: undefined, unread: 0 }}>
              <MemoryRouter><Chat /></MemoryRouter>
            </ChatsContext.Provider>
          </ProfileContext.Provider>
        </IdentityContext.Provider>
      </Provider>,
    )
    expect(screen.getByRole('status', { name: 'Загрузка чатов' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Чат' })).toBeInTheDocument()
  })

  it('«Вы:» и имя автора в общем чате выделены отдельно от текста', () => {
    const chats: ChatSummary[] = [{ id: 'family', last: m('1', 'm2', 'ужин'), unread: 0 }]
    render(providers(<MemoryRouter><Chat /></MemoryRouter>, { chats }))
    expect(screen.getByText('Миша:')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Общий чат/ })).toHaveTextContent('Миша: ужин')
  })
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

describe('статус моего последнего сообщения в списке', () => {
  const at = '2026-10-11T10:00:00Z'
  it('две галочки, если прочитано, одна, если нет; у чужого последнего сообщения и без readUpTo галочек нет', () => {
    const chats: ChatSummary[] = [
      { id: 'family', last: m('1', 'me', 'прочитано', at), unread: 0, readUpTo: '2026-10-11T10:05:00Z' },
      { id: 'm2', last: m('2', 'me', 'не прочитано', at), unread: 0, readUpTo: '2026-10-11T09:00:00Z' },
      { id: 'm3', last: m('3', 'm3', 'от Ани', at), unread: 0, readUpTo: '2026-10-11T10:05:00Z' },
      { id: 'papa', last: m('4', 'me', 'старый сервер', at), unread: 0 },
    ]
    render(providers(<MemoryRouter><Chat /></MemoryRouter>, { chats }))
    const links = screen.getAllByRole('link')
    expect(within(links[0]).getByRole('img', { name: 'Прочитано' })).toBeInTheDocument()
    expect(within(links[1]).getByRole('img', { name: 'Отправлено' })).toBeInTheDocument()
    expect(within(links[2]).queryByRole('img')).not.toBeInTheDocument()
    expect(within(links[3]).queryByRole('img')).not.toBeInTheDocument()
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

  // долгое нажатие: контекстное меню (правая кнопка мыши, Android) или удержание пальца
  const hold = (el: HTMLElement) => fireEvent.contextMenu(el)

  it('обычное нажатие окно не открывает', async () => {
    renderRoom('me', [m('1', 'm2', 'Просто нажатие')])
    await userEvent.click(await screen.findByRole('button', { name: /Просто нажатие/ }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('удержание пальца открывает окно только после паузы; сдвиг пальца (прокрутка) отменяет', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      renderRoom('me', [m('1', 'm2', 'Держим')])
      const bubble = await screen.findByRole('button', { name: /Держим/ })
      fireEvent.pointerDown(bubble, { pointerType: 'touch', clientX: 10, clientY: 10, button: 0 })
      await act(async () => { await vi.advanceTimersByTimeAsync(200) })
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      await act(async () => { await vi.advanceTimersByTimeAsync(300) })
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })

  it('пока палец держит сообщение, выделение текста блокируется, а после отпускания защита снимается', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      renderRoom('me', [m('1', 'm2', 'Не выделять')])
      const bubble = await screen.findByRole('button', { name: /Не выделять/ })
      const selectStart = () => {
        const event = new Event('selectstart', { bubbles: true, cancelable: true })
        document.dispatchEvent(event)
        return event.defaultPrevented
      }
      // защита от прошлых тестов (их таймеры сняты вместе с поддельными часами): один пробный цикл нажатия
      fireEvent.pointerDown(bubble, { pointerType: 'touch', clientX: 10, clientY: 10, button: 0 })
      fireEvent.pointerUp(bubble, { pointerType: 'touch' })
      await act(async () => { await vi.advanceTimersByTimeAsync(1000) })
      expect(selectStart()).toBe(false)
      fireEvent.pointerDown(bubble, { pointerType: 'touch', clientX: 10, clientY: 10, button: 0 })
      expect(selectStart()).toBe(true)
      fireEvent.pointerUp(bubble, { pointerType: 'touch' })
      await act(async () => { await vi.advanceTimersByTimeAsync(1000) })
      expect(selectStart()).toBe(false)
    } finally {
      vi.useRealTimers()
    }
  })

  it('палец сдвинулся: окно не открывается', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      renderRoom('me', [m('1', 'm2', 'Прокрутка')])
      const bubble = await screen.findByRole('button', { name: /Прокрутка/ })
      fireEvent.pointerDown(bubble, { pointerType: 'touch', clientX: 10, clientY: 10, button: 0 })
      fireEvent.pointerMove(bubble, { pointerType: 'touch', clientX: 10, clientY: 60 })
      await act(async () => { await vi.advanceTimersByTimeAsync(700) })
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })

  it('родитель удерживает сообщение ребёнка: реакция применяется сразу, окно закрывается, под сообщением обновляется', async () => {
    renderRoom('me', [m('1', 'm2', 'Сдал контрольную')])
    const updated = { ...m('1', 'm2', 'Сдал контрольную'), reactions: [{ memberId: 'me', emoji: '🔥' }], awards: [] }
    vi.mocked(api.giveFeedback).mockResolvedValue({ message: updated })
    const user = userEvent.setup()

    hold(await screen.findByRole('button', { name: /Сдал контрольную/ }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Реакция 🔥' }))

    expect(api.giveFeedback).toHaveBeenCalledWith('tok', 'family', '1', { emoji: '🔥' })
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(await screen.findByLabelText('Реакция 🔥')).toBeInTheDocument()
  })

  it('монеты за сообщение ребёнка применяются сразу одним нажатием', async () => {
    renderRoom('me', [m('1', 'm2', 'Получил пятёрку')])
    vi.mocked(api.giveFeedback).mockResolvedValue({ message: { ...m('1', 'm2', 'Получил пятёрку'), reactions: [], awards: [{ amount: 20, by: 'me' }] } })
    hold(await screen.findByRole('button', { name: /Получил пятёрку/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Начислить 20 монет' }))
    expect(api.giveFeedback).toHaveBeenCalledWith('tok', 'family', '1', { coins: 20 })
    expect(await screen.findByLabelText('Начислено монет: 20')).toBeInTheDocument()
  })

  it('моя прежняя реакция в окне уже выбрана', async () => {
    renderRoom('me', [kidMessage])
    hold(await screen.findByRole('button', { name: /Получил пятёрку/ }))
    expect(within(screen.getByRole('dialog')).getByRole('button', { name: 'Реакция 👏' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('работает и в личном чате с ребёнком', async () => {
    renderRoom('me', [m('1', 'm2', 'Мам, смотри')], 'm2')
    hold(await screen.findByRole('button', { name: /Мам, смотри/ }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('на сообщения взрослых и свои у родителя реакцию поставить можно, а монет нет', async () => {
    renderRoom('me', [m('1', 'me', 'Моё сообщение'), m('2', 'papa', 'Сообщение папы')])
    hold(await screen.findByRole('button', { name: /Сообщение папы/ }))
    expect(screen.getByRole('button', { name: 'Реакция 👍' })).toBeInTheDocument()
    expect(screen.queryByRole('group', { name: 'Монеты' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Моё сообщение/ })).toBeInTheDocument()
  })

  it('ребёнок может поставить реакцию на любое сообщение, но монет у него нет', async () => {
    renderRoom('m2', [m('1', 'm2', 'Своё'), m('2', 'me', 'От мамы')])
    hold(await screen.findByRole('button', { name: /От мамы/ }))
    expect(screen.getByRole('button', { name: 'Реакция 👍' })).toBeInTheDocument()
    expect(screen.queryByRole('group', { name: 'Монеты' })).not.toBeInTheDocument()
  })

  it('с клавиатуры (Enter) тоже открывается окно', async () => {
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
      <ChatsContext.Provider value={{ chats: [], unread }}>
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
    render(<Composer onSend={onSend} onUploadFile={vi.fn()} onUpload={vi.fn()} />)
    const field = screen.getByLabelText('Сообщение')
    await user.type(field, 'первая{Shift>}{Enter}{/Shift}вторая')
    expect(onSend).not.toHaveBeenCalled()
    await user.keyboard('{Enter}')
    expect(onSend).toHaveBeenCalledWith({ text: 'первая\nвторая', mediaIds: [], fileIds: [] })
    await waitFor(() => expect(field).toHaveValue(''))
  })

  it('пока пусто, отправить нельзя', async () => {
    const onSend = vi.fn()
    const user = userEvent.setup()
    render(<Composer onSend={onSend} onUploadFile={vi.fn()} onUpload={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Отправить' })).toBeDisabled()
    await user.type(screen.getByLabelText('Сообщение'), '   {Enter}')
    expect(onSend).not.toHaveBeenCalled()
  })

  it('при ошибке текст остаётся и показано сообщение', async () => {
    const onSend = vi.fn().mockRejectedValue(new Error('x'))
    const user = userEvent.setup()
    render(<Composer onSend={onSend} onUploadFile={vi.fn()} onUpload={vi.fn()} />)
    await user.type(screen.getByLabelText('Сообщение'), 'привет{Enter}')
    expect(await screen.findByText(/Не удалось отправить сообщение/)).toBeInTheDocument()
    expect(screen.getByLabelText('Сообщение')).toHaveValue('привет')
  })
})

describe('переписка: загрузка', () => {
  it('пока сообщения грузятся, шапка, лента с заглушкой и поле ввода уже на месте', async () => {
    vi.mocked(api.listMessages).mockImplementation(() => new Promise(() => {}))
    window.scrollTo = vi.fn() as unknown as typeof window.scrollTo
    render(
      providers(
        <MemoryRouter initialEntries={['/chat/m2']}>
          <Routes><Route path="/chat/:chat" element={<ChatRoom />} /></Routes>
        </MemoryRouter>,
      ),
    )
    expect(screen.getByRole('heading', { name: 'Миша' })).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Загрузка…')
    expect(screen.getByLabelText('Сообщение')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'К списку чатов' })).toBeInTheDocument()
  })
})

describe('переписка', () => {
  const renderRoom = (chat = 'family') => {
    render(
      providers(
        <MemoryRouter initialEntries={[`/chat/${chat}`]}>
          <Routes>
            <Route path="/chat/:chat" element={<ChatRoom />} />
            <Route path="/chat" element={<p>Список чатов</p>} />
          </Routes>
        </MemoryRouter>,
      ),
    )
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

  it('личная переписка: аватар и имя сверху ведут в профиль собеседника, в общем чате ссылки нет', async () => {
    vi.mocked(api.listMessages).mockResolvedValue({ messages: [], hasMore: false, readUpTo: null, peer: null })
    renderRoom('m2')
    const heading = await screen.findByRole('heading', { name: /Миша/ })
    expect(heading.closest('a')).toHaveAttribute('href', '/family/m2')
    cleanup()
    renderRoom('family')
    const family = await screen.findByRole('heading', { name: 'Общий чат' })
    expect(family.closest('a')).toBeNull()
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

  it('общий чат: под заголовком число участников, в личном его нет', async () => {
    vi.mocked(api.listMessages).mockResolvedValue({ messages: [m('1', 'm2', 'привет')], hasMore: false, readUpTo: null, peer: null })
    renderRoom('family')
    await screen.findByText('привет')
    expect(screen.getByText('2 участника')).toBeInTheDocument()
    cleanup()
    renderRoom('m2')
    await screen.findByText('привет')
    expect(screen.queryByText(/участник/)).not.toBeInTheDocument()
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
    renderRoom('m2')
    await screen.findByText('привет')
    await waitFor(() => expect(api.markChatRead).toHaveBeenCalledWith('tok', 'm2'))
    expect(api.markChatRead).toHaveBeenCalledTimes(1)
  })

  it('сигнал сокета обновляет переписку, но повторной отметки о прочтении нет (иначе бесконечный цикл)', async () => {
    const listeners = new Set<Listener>()
    vi.mocked(api.listMessages).mockResolvedValue({ messages: [m('1', 'm2', 'привет')], hasMore: false, readUpTo: null, peer: null })
    render(
      <RealtimeContext.Provider value={{ subscribe: (l) => (listeners.add(l), () => void listeners.delete(l)), setViewing: () => {} }}>
        {providers(
          <>
          <RealtimeBridge />
          <MemoryRouter initialEntries={['/chat/m2']}>
            <Routes><Route path="/chat/:chat" element={<ChatRoom />} /></Routes>
          </MemoryRouter>
          </>,
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

  it('отправка: сообщение появляется сразу', async () => {
    vi.mocked(api.listMessages).mockResolvedValue({ messages: [], hasMore: false, readUpTo: null, peer: null })
    vi.mocked(api.sendMessage).mockResolvedValue({ message: m('9', 'me', 'всем привет') })
    renderRoom('family')
    const user = userEvent.setup()
    await user.type(await screen.findByLabelText('Сообщение'), 'всем привет{Enter}')
    expect(api.sendMessage).toHaveBeenCalledWith('tok', 'family', 'всем привет')
    expect(await screen.findByText('всем привет')).toBeInTheDocument()
  })

  it('фото: выбрано, загружено, отправлено сообщением, видно в переписке и открывается на весь экран', async () => {
    URL.createObjectURL = vi.fn(() => 'blob:preview')
    URL.revokeObjectURL = vi.fn()
    vi.mocked(api.listMessages).mockResolvedValue({ messages: [], hasMore: false, readUpTo: null, peer: null })
    vi.mocked(api.uploadChatPhoto).mockResolvedValue({ mediaId: 'media-1', width: 800, height: 600 })
    const photo = { id: 'media-1', width: 800, height: 600, thumbUrl: '/media/f/media-1/thumb?exp=1&sig=a', fullUrl: '/media/f/media-1/full?exp=1&sig=a' }
    vi.mocked(api.sendMessage).mockResolvedValue({ message: { ...m('9', 'me', '📷 Фото'), caption: '', media: [photo] } })
    renderRoom('family')
    const user = userEvent.setup()
    await screen.findByLabelText('Сообщение')
    fireEvent.change(screen.getByLabelText('Выбрать фото или файл'), { target: { files: [new File(['x'], 'a.jpg', { type: 'image/jpeg' })] } })
    await waitFor(() => expect(api.uploadChatPhoto).toHaveBeenCalledWith('tok', 'family', expect.any(Blob)))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Отправить' })).toBeEnabled())
    await user.click(screen.getByRole('button', { name: 'Отправить' }))
    expect(api.sendMessage).toHaveBeenCalledWith('tok', 'family', '', ['media-1'])

    // в ленте фото, а не заглушка «📷 Фото»
    const open = await screen.findByRole('button', { name: 'Открыть фото' })
    expect(screen.queryByText('📷 Фото')).toBeNull()
    await user.click(open)
    expect(screen.getByRole('dialog', { name: 'Просмотр фото' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Фото 1' })).toHaveAttribute('src', photo.fullUrl)
    await user.click(screen.getByRole('button', { name: 'Закрыть' }))
    expect(screen.queryByRole('dialog', { name: 'Просмотр фото' })).toBeNull()
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

describe('прокрутка переписки', () => {
  // подставной ResizeObserver: тест сам сообщает, что размеры ленты изменились (клавиатура, фото, поле ввода)
  let resized: (() => void) | undefined
  class FakeObserver {
    constructor(cb: () => void) {
      resized = cb
    }
    observe() {}
    disconnect() {}
  }

  // размеры ленты в jsdom нулевые: задаём их сами
  function sizeFeed(feed: HTMLElement, scrollHeight: number, clientHeight: number) {
    Object.defineProperty(feed, 'scrollHeight', { configurable: true, get: () => scrollHeight })
    Object.defineProperty(feed, 'clientHeight', { configurable: true, get: () => clientHeight })
  }

  async function renderRoom() {
    vi.stubGlobal('ResizeObserver', FakeObserver)
    vi.mocked(api.listMessages).mockResolvedValue({ messages: [m('1', 'm2', 'последнее')], hasMore: false, readUpTo: null, peer: null })
    render(
      providers(
        <MemoryRouter initialEntries={['/chat/family']}>
          <Routes><Route path="/chat/:chat" element={<ChatRoom />} /></Routes>
        </MemoryRouter>,
      ),
    )
    await screen.findByText('последнее')
    return screen.getByText('последнее').closest('main')!.querySelector<HTMLElement>('[class]:has(> [class] > section)')!
  }

  it('прижатая к низу лента после изменения размеров снова у низа (клавиатура выезжает постепенно, фото догрузилось)', async () => {
    const feed = await renderRoom()
    sizeFeed(feed, 2000, 600)
    feed.scrollTop = 1400
    fireEvent.scroll(feed)
    // клавиатура уменьшила ленту на 300px, потом ещё на 100px: каждый раз обратно к низу
    sizeFeed(feed, 2000, 300)
    act(() => resized?.())
    expect(feed.scrollTop).toBe(2000)
    sizeFeed(feed, 2400, 200)
    act(() => resized?.())
    expect(feed.scrollTop).toBe(2400)
    vi.unstubAllGlobals()
  })

  it('прокрученную вверх ленту изменение размеров не трогает', async () => {
    const feed = await renderRoom()
    sizeFeed(feed, 2000, 600)
    feed.scrollTop = 200
    fireEvent.scroll(feed)
    sizeFeed(feed, 2000, 300)
    act(() => resized?.())
    expect(feed.scrollTop).toBe(200)
    vi.unstubAllGlobals()
  })
})
