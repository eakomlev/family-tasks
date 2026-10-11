import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as api from '@/api'
import type { Member } from '@/api'
import { IdentityContext } from '@/identity/context'
import type { Identity } from '@/identity/types'
import Tasks from '@/pages/Tasks'
import { ProfileContext } from '@/profile/context'
import { occ, task } from '../helpers'

vi.mock('@/api', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/api')>()), listTasks: vi.fn(), listDoneTasks: vi.fn() }))

const members: Member[] = [
  { id: 'mama', name: 'Лена', role: 'mama', avatar: null, isOwner: true },
  { id: 'kid', name: 'Миша', role: 'child', avatar: null, isOwner: false },
]

function renderTasks(role: Identity['role']) {
  const me = role === 'child' ? members[1] : members[0]
  const identity: Identity = { familyCode: 'c', memberId: me.id, name: me.name, role, token: 'tok' }
  return render(
    <IdentityContext.Provider value={{ identity, save: async () => {}, clear: async () => {} }}>
      <ProfileContext.Provider value={{ data: { me: { ...me, email: 'x@y.z' }, members }, failed: false, refresh: async () => {} }}>
        <MemoryRouter><Tasks /></MemoryRouter>
      </ProfileContext.Provider>
    </IdentityContext.Provider>,
  )
}

beforeEach(() => {
  vi.mocked(api.listTasks).mockReset().mockResolvedValue({
    tasks: [task({ id: 'a', title: 'Вынести мусор', assigneeId: 'kid', authorId: 'mama' })],
    occurrences: [occ('a', null)],
  })
})

describe('страница «Задания»: фильтр по людям', () => {
  it('у родителя есть фильтр: все, мои и по каждому участнику', async () => {
    renderTasks('mama')
    await screen.findByText('Вынести мусор')
    const group = screen.getByLabelText('Чьи задания')
    expect(group).toHaveTextContent('Все')
    expect(group).toHaveTextContent('Мои')
    expect(group).toHaveTextContent('Миша')
  })

  it('у ребёнка фильтра нет: сервер и так отдаёт только его задания', async () => {
    renderTasks('child')
    await screen.findByText('Вынести мусор')
    expect(screen.queryByLabelText('Чьи задания')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Лена' })).not.toBeInTheDocument()
  })
})
