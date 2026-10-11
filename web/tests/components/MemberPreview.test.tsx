import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import type { Member } from '@/api'
import { IdentityContext } from '@/identity/context'
import MemberPreview from '@/pages/MemberPreview'
import { ProfileContext } from '@/profile/context'

const members: Member[] = [
  { id: 'me', name: 'Лена', role: 'mama', avatar: null, isOwner: true },
  { id: 'kid', name: 'Миша', role: 'child', avatar: null, isOwner: false, birthDate: '2016-05-12' },
]

function renderAt(path: string) {
  const identity = { familyCode: 'c', memberId: 'me', name: 'Лена', role: 'mama' as const, token: 'tok' }
  render(
    <IdentityContext.Provider value={{ identity, save: async () => {}, clear: async () => {} }}>
      <ProfileContext.Provider value={{ data: { me: { ...members[0], email: 'l@x.y' }, members }, failed: false, refresh: async () => {} }}>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="/family/:memberId" element={<MemberPreview />} />
            <Route path="/profile" element={<p>Мой профиль</p>} />
          </Routes>
        </MemoryRouter>
      </ProfileContext.Provider>
    </IdentityContext.Provider>,
  )
}

describe('страница другого участника', () => {
  it('есть значок чата, который ведёт в личный чат с этим человеком', () => {
    renderAt('/family/kid')
    const link = screen.getByRole('link', { name: 'Написать: Миша' })
    expect(link).toHaveAttribute('href', '/chat/kid')
  })

  it('свою страницу открывает как профиль: там чата с самим собой нет', () => {
    renderAt('/family/me')
    expect(screen.getByText('Мой профиль')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Написать/ })).not.toBeInTheDocument()
  })
})
