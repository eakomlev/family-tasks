import { render, screen } from '@testing-library/react'
import { Provider } from 'react-redux'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Member } from '@/api'
import { ConfirmProvider } from '@/components/ConfirmDialog'
import { IdentityContext } from '@/identity/context'
import Profile from '@/pages/Profile'
import Service from '@/pages/Service'
import { ProfileContext } from '@/profile/context'
import { makeStore } from '@/store'
import { setSession } from '@/store/session'

const me: Member = { id: 'me', name: 'Евгений', role: 'papa', avatar: null, isOwner: true }
const stats = { accounts: { total: 1234, today: 3 }, families: { total: 400, today: 1 }, messages: { total: 56789, today: 120 } }

function renderAt(path: string, isAdmin: boolean) {
  const identity = { familyCode: 'c', memberId: 'me', name: 'Евгений', role: 'papa' as const, token: 'tok' }
  return render(
    <Provider store={makeStore({ hydrate: false })}>
      <IdentityContext.Provider value={{ identity, save: async () => {}, clear: async () => {} }}>
        <ProfileContext.Provider value={{ data: { me: { ...me, email: 'a@b.c', isAdmin }, members: [me] }, failed: false }}>
          <ConfirmProvider>
            <MemoryRouter initialEntries={[path]}>
              <Routes>
                <Route path="/profile" element={<Profile />} />
                <Route path="/profile/service" element={<Service />} />
              </Routes>
            </MemoryRouter>
          </ConfirmProvider>
        </ProfileContext.Provider>
      </IdentityContext.Provider>
    </Provider>,
  )
}

beforeEach(() => setSession({ token: 'tok', memberId: 'me' }))
afterEach(() => {
  vi.unstubAllGlobals()
  setSession(undefined)
})

describe('раздел «Сервис»', () => {
  it('в профиле ссылка «Сервис» только у администратора', () => {
    renderAt('/profile', true)
    expect(screen.getByRole('link', { name: /Сервис/ })).toHaveAttribute('href', '/profile/service')
  })

  it('у остальных ссылки нет, а страница ведёт обратно в профиль', async () => {
    renderAt('/profile', false)
    expect(screen.queryByRole('link', { name: /Сервис/ })).not.toBeInTheDocument()
    renderAt('/profile/service', false)
    expect(await screen.findAllByRole('heading', { name: 'Профиль' })).not.toHaveLength(0)
  })

  it('администратору показаны аккаунты, семьи и сообщения, всего и за сегодня', async () => {
    const fetchMock = vi.fn(async (url: string) => (String(url).startsWith('/api/admin/stats') ? new Response(JSON.stringify(stats)) : new Response('{}', { status: 500 })))
    vi.stubGlobal('fetch', fetchMock)
    renderAt('/profile/service', true)
    expect(await screen.findByText('1 234')).toBeInTheDocument()
    expect(screen.getByText('56 789')).toBeInTheDocument()
    const accounts = screen.getByRole('region', { name: 'Аккаунты' })
    expect(accounts).toHaveTextContent('Новых сегодня3')
    expect(screen.getByRole('region', { name: 'Сообщения' })).toHaveTextContent('Сегодня120')
    // начало дня уходит параметром: часовой пояс знает клиент
    expect(String(fetchMock.mock.calls[0][0])).toMatch(/^\/api\/admin\/stats\?since=\d{4}-\d{2}-\d{2}T/)
  })

  it('ошибка загрузки показывается, страница не ломается', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 500 })))
    renderAt('/profile/service', true)
    expect(await screen.findByText(/Не удалось загрузить статистику/)).toBeInTheDocument()
  })
})
