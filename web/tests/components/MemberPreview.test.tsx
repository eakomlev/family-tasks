import { render, screen } from '@testing-library/react'
import { Provider } from 'react-redux'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as api from '@/api'
import type { Member } from '@/api'
import { IdentityContext } from '@/identity/context'
import MemberPreview from '@/pages/MemberPreview'
import { ProfileContext } from '@/profile/context'
import { makeStore } from '@/store'
import { setSession } from '@/store/session'

vi.mock('@/api', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/api')>()), getCoinBalance: vi.fn() }))

beforeEach(() => {
  setSession({ token: 'tok', memberId: 'me' })
  vi.mocked(api.getCoinBalance).mockReset()
  vi.mocked(api.getCoinBalance).mockResolvedValue(45)
})

const members: Member[] = [
  { id: 'me', name: 'Лена', role: 'mama', avatar: null, isOwner: true },
  { id: 'kid', name: 'Миша', role: 'child', avatar: null, isOwner: false, birthDate: '2016-05-12' },
]

function renderAt(path: string) {
  const identity = { familyCode: 'c', memberId: 'me', name: 'Лена', role: 'mama' as const, token: 'tok' }
  render(
    <Provider store={makeStore({ hydrate: false })}>
    <IdentityContext.Provider value={{ identity, save: async () => {}, clear: async () => {} }}>
      <ProfileContext.Provider value={{ data: { me: { ...members[0], email: 'l@x.y' }, members }, failed: false, refresh: async () => {} }}>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="/family/:memberId" element={<MemberPreview />} />
            <Route path="/profile" element={<p>Мой профиль</p>} />
          </Routes>
        </MemoryRouter>
      </ProfileContext.Provider>
    </IdentityContext.Provider>
    </Provider>,
  )
}

describe('страница другого участника', () => {
  it('есть значок чата, который ведёт в личный чат с этим человеком', () => {
    renderAt('/family/kid')
    const link = screen.getByRole('link', { name: 'Написать: Миша' })
    expect(link).toHaveAttribute('href', '/chat/kid')
  })

  it('родителю у ребёнка показан баланс со ссылкой на историю', async () => {
    renderAt('/family/kid')
    const link = await screen.findByRole('link', { name: /45/ })
    expect(link).toHaveAttribute('href', '/coins/kid')
    expect(api.getCoinBalance).toHaveBeenCalledWith('tok', 'kid')
  })

  it('свою страницу открывает как профиль: там чата с самим собой нет', () => {
    renderAt('/family/me')
    expect(screen.getByText('Мой профиль')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Написать/ })).not.toBeInTheDocument()
  })
})
