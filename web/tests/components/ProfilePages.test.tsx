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
      <ProfileContext.Provider value={{ data: { me: { ...me, email: 'l@x.y', birthDate: '1990-05-01' }, members: [me] }, failed: false }}>
        <MemoryRouter>{page}</MemoryRouter>
      </ProfileContext.Provider>
    </IdentityContext.Provider>
    </Provider>,
  )
}

describe('таб-бар без «Настроек»', () => {
  it('четыре таба, как в приложении: мой день, задачи, чат, семья', () => {
    expect(TABS.map((t) => t.path)).toEqual(['/my-day', '/tasks', '/chat', '/family'])
    expect(TABS.map((t) => t.label)).toEqual(['Мой день', 'Задачи', 'Чат', 'Семья'])
    render(
      <ChatsContext.Provider value={{ chats: [], unread: 0 }}>
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
    expect(screen.getByRole('link', { name: 'Назад' })).toHaveAttribute('href', '/profile')
    expect(screen.getByRole('heading', { name: 'Изменить профиль' })).toBeInTheDocument()
  })

  it('«Уведомления и звуки» и «Оформление» открываются отдельными страницами со ссылкой назад', () => {
    renderPage(<ProfileNotifications />)
    expect(screen.getByRole('heading', { name: 'Уведомления и звуки' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Назад' })).toHaveAttribute('href', '/profile')
  })

  it('оформление: три варианта темы и размер шрифта', () => {
    renderPage(<ProfileTheme />)
    expect(screen.getByRole('heading', { name: 'Оформление' })).toBeInTheDocument()
    expect(screen.getAllByRole('radio')).toHaveLength(3)
    expect(screen.getByRole('slider')).toBeInTheDocument()
  })
})
