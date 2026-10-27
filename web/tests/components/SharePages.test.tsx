import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { Provider } from 'react-redux'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { ChatSummary, Member } from '@/api'
import { ChatsContext } from '@/chat/context'
import { ConfirmProvider } from '@/components/ConfirmDialog'
import { IdentityContext } from '@/identity/context'
import ChatArchive from '@/pages/ChatArchive'
import ProfileNotifications from '@/pages/ProfileNotifications'
import ProfileTheme from '@/pages/ProfileTheme'
import Share from '@/pages/Share'
import { ProfileContext } from '@/profile/context'
import { makeStore } from '@/store'
import { setSession } from '@/store/session'

const members: Member[] = [
  { id: 'me', name: 'Лена', role: 'mama', avatar: null, isOwner: true },
  { id: 'm2', name: 'Миша', role: 'child', avatar: null, isOwner: false },
]

function Landing() {
  const { state, pathname } = useLocation()
  return <p>{`${pathname} ${(state as { share?: string } | null)?.share ?? ''}`}</p>
}

function renderPage(path: string, element: React.ReactNode, chats: ChatSummary[] | undefined) {
  const identity = { familyCode: 'c', memberId: 'me', name: 'Лена', role: 'mama' as const, token: 'tok' }
  render(
    <Provider store={makeStore({ hydrate: false })}>
      <IdentityContext.Provider value={{ identity, save: async () => {}, clear: async () => {} }}>
        <ProfileContext.Provider value={{ data: { me: { ...members[0], email: 'l@x.y' }, members }, failed: false }}>
          <ChatsContext.Provider value={{ chats, unread: 0 }}>
            <ConfirmProvider>
              <MemoryRouter initialEntries={[path]}>
                <Routes>
                  <Route path="/share" element={element} />
                  <Route path="/chat/archive" element={element} />
                  <Route path="/profile/theme" element={element} />
                  <Route path="/profile/notifications" element={element} />
                  <Route path="/chat/:chat" element={<Landing />} />
                </Routes>
              </MemoryRouter>
            </ConfirmProvider>
          </ChatsContext.Provider>
        </ProfileContext.Provider>
      </IdentityContext.Provider>
    </Provider>,
  )
}

const chat = (id: string, over: Partial<ChatSummary> = {}): ChatSummary => ({ id, last: null, unread: 0, ...over })

beforeEach(() => {
  setSession({ token: 'tok', memberId: 'me' })
})
afterEach(() => {
  cleanup()
  localStorage.clear()
  document.documentElement.style.fontSize = ''
})

describe('Поделиться', () => {
  it('без текста объясняет, что отправлять нечего', () => {
    renderPage('/share', <Share />, [chat('family')])
    expect(screen.getByText(/Нечего отправлять/)).toBeInTheDocument()
    expect(screen.queryByText('В какой чат отправить?')).not.toBeInTheDocument()
  })

  it('склеивает заголовок, текст и ссылку и показывает их над списком чатов', () => {
    renderPage('/share?title=Фильм&text=Смотрим%20вечером&url=https://example.com/a', <Share />, [chat('family'), chat('m2')])
    expect(screen.getByText(/Фильм\s+Смотрим вечером\s+https:\/\/example.com\/a/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Общий чат' })).toHaveAttribute('href', '/chat/family')
    expect(screen.getByRole('link', { name: 'Миша' })).toHaveAttribute('href', '/chat/m2')
  })

  it('пока чаты грузятся, пишет «Загрузка…»', () => {
    renderPage('/share?text=привет', <Share />, undefined)
    expect(screen.getByText('Загрузка…')).toBeInTheDocument()
  })

  it('выбранный чат открывается с общим текстом в состоянии перехода', () => {
    renderPage('/share?text=привет', <Share />, [chat('m2')])
    fireEvent.click(screen.getByRole('link', { name: 'Миша' }))
    expect(screen.getByText('/chat/m2 привет')).toBeInTheDocument()
  })
})

describe('Архив чатов', () => {
  it('пока список не пришёл, пишет «Загрузка…»', () => {
    renderPage('/chat/archive', <ChatArchive />, undefined)
    expect(screen.getByText('Загрузка…')).toBeInTheDocument()
  })

  it('без архивных чатов подсказывает, как туда попасть', () => {
    renderPage('/chat/archive', <ChatArchive />, [chat('family'), chat('m2')])
    expect(screen.getByText(/В архиве пусто/)).toBeInTheDocument()
  })

  it('показывает только архивные чаты', () => {
    renderPage('/chat/archive', <ChatArchive />, [chat('family'), chat('m2', { archived: true })])
    expect(screen.getByRole('link', { name: /Миша/ })).toHaveAttribute('href', '/chat/m2')
    expect(screen.queryByRole('link', { name: /Общий чат/ })).not.toBeInTheDocument()
    expect(screen.queryByText(/В архиве пусто/)).not.toBeInTheDocument()
  })
})

describe('Оформление и звуки', () => {
  it('ползунок меняет размер шрифта, сохраняет его и применяет к странице', () => {
    renderPage('/profile/theme', <ProfileTheme />, [])
    expect(screen.getByText('Размер шрифта: 100%')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Стандартный размер' })).not.toBeInTheDocument()
    fireEvent.change(screen.getByRole('slider'), { target: { value: '1.25' } })
    expect(screen.getByText('Размер шрифта: 125%')).toBeInTheDocument()
    expect(localStorage.getItem('fontScale')).toBe('1.25')
    expect(document.documentElement.style.fontSize).toBe('125%')
  })

  it('«Стандартный размер» возвращает 100% и стирает сохранённое', () => {
    localStorage.setItem('fontScale', '1.3')
    renderPage('/profile/theme', <ProfileTheme />, [])
    expect(screen.getByText('Размер шрифта: 130%')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Стандартный размер' }))
    expect(screen.getByText('Размер шрифта: 100%')).toBeInTheDocument()
    expect(localStorage.getItem('fontScale')).toBeNull()
    expect(document.documentElement.style.fontSize).toBe('')
  })

  it('звук при отправке: по умолчанию включён, переключатель сохраняется', () => {
    renderPage('/profile/notifications', <ProfileNotifications />, [])
    const box = screen.getByRole('switch', { name: /Звук и вибрация/ })
    expect(box).toBeChecked()
    fireEvent.click(box)
    expect(box).not.toBeChecked()
    expect(localStorage.getItem('sendSound')).toBe('0')
    fireEvent.click(box)
    expect(localStorage.getItem('sendSound')).toBeNull()
  })

  it('на «Уведомления и звуки» есть переключатель уведомлений и звуки игр', () => {
    renderPage('/profile/notifications', <ProfileNotifications />, [])
    expect(screen.getByRole('switch', { name: 'Уведомления' })).toBeInTheDocument()
    expect(screen.getByRole('switch', { name: /Звуки в играх/ })).toBeChecked()
  })

  it('«Оформление» собирает тему и размер шрифта на одной странице', () => {
    renderPage('/profile/theme', <ProfileTheme />, [])
    expect(screen.getByRole('heading', { name: 'Оформление' })).toBeInTheDocument()
    expect(screen.getByRole('radiogroup', { name: 'Тема оформления' })).toBeInTheDocument()
    expect(screen.getByRole('slider')).toBeInTheDocument()
  })
})
