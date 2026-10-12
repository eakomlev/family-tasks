import { render, screen } from '@testing-library/react'
import { Provider } from 'react-redux'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { makeStore } from '@/store'
import type { Member } from '@/api'
import { TabBar } from '@/components/TabBar'
import { TABS } from '@/components/TabBar/utils'
import { ChatsContext } from '@/chat/context'
import { IdentityContext } from '@/identity/context'
import ProfileEdit from '@/pages/ProfileEdit'
import ProfileNotifications from '@/pages/ProfileNotifications'
import ProfileTheme from '@/pages/ProfileTheme'
import { ProfileContext } from '@/profile/context'

const me: Member = { id: 'me', name: 'Лена', role: 'mama', avatar: null, isOwner: true }

function renderPage(page: React.ReactNode) {
  const identity = { familyCode: 'c', memberId: 'me', name: 'Лена', role: 'mama' as const, token: 'tok' }
  render(
    <Provider store={makeStore({ hydrate: false })}>
    <IdentityContext.Provider value={{ identity, save: async () => {}, clear: async () => {} }}>
      <ProfileContext.Provider value={{ data: { me: { ...me, email: 'l@x.y', birthDate: '1990-05-01' }, members: [me] }, failed: false, refresh: async () => {} }}>
        <MemoryRouter>{page}</MemoryRouter>
      </ProfileContext.Provider>
    </IdentityContext.Provider>
    </Provider>,
  )
}

describe('таб-бар без «Настроек»', () => {
  it('четыре таба: задачи, чат, мой день, семья', () => {
    expect(TABS.map((t) => t.path)).toEqual(['/tasks', '/chat', '/my-day', '/family'])
    render(
      <ChatsContext.Provider value={{ chats: [], unread: 0, refresh: async () => {} }}>
        <MemoryRouter><TabBar /></MemoryRouter>
      </ChatsContext.Provider>,
    )
    expect(screen.getAllByRole('link')).toHaveLength(4)
    expect(screen.queryByRole('link', { name: /Настройки/ })).not.toBeInTheDocument()
  })
})

describe('страницы профиля', () => {
  it('«Изменить профиль»: имя и дата рождения в форме, ссылка назад в профиль', () => {
    renderPage(<ProfileEdit />)
    expect(screen.getByLabelText('Имя')).toHaveValue('Лена')
    expect(screen.getByLabelText(/^Дата рождения/)).toHaveValue('1990-05-01')
    expect(screen.getByRole('link', { name: /Профиль/ })).toHaveAttribute('href', '/profile')
  })

  it('«Уведомления» и «Тема» открываются отдельными страницами со ссылкой назад', () => {
    renderPage(<ProfileNotifications />)
    expect(screen.getByRole('heading', { name: 'Уведомления' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Профиль/ })).toHaveAttribute('href', '/profile')
  })

  it('тема: три варианта выбора', () => {
    renderPage(<ProfileTheme />)
    expect(screen.getByRole('heading', { name: 'Тема оформления' })).toBeInTheDocument()
    expect(screen.getAllByRole('radio')).toHaveLength(3)
  })
})
