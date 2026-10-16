import { render, screen } from '@testing-library/react'
import { Provider } from 'react-redux'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { makeStore } from '@/store'
import { setSession } from '@/store/session'
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
    <Provider store={makeStore({ hydrate: false })}>
    <IdentityContext.Provider value={{ identity, save: async () => {}, clear: async () => {} }}>
      <ProfileContext.Provider value={{ data: { me: { ...me, email: 'x@y.z' }, members }, failed: false }}>
        <MemoryRouter><Tasks /></MemoryRouter>
      </ProfileContext.Provider>
    </IdentityContext.Provider>
    </Provider>,
  )
}

beforeEach(() => {
  setSession({ token: 'tok', memberId: 'm1' })
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

describe('нет связи', () => {
  it('вместо «Не удалось загрузить» показывается загрузка, а данные запрашиваются снова, пока не получится', async () => {
    vi.mocked(api.listTasks).mockRejectedValueOnce(new api.ApiError(0, 'network'))
    renderTasks('mama')
    expect(screen.getByText('Загрузка…')).toBeInTheDocument()
    expect(screen.queryByText(/Не удалось загрузить/)).not.toBeInTheDocument()
    // повтор через 2–3 секунды
    expect(await screen.findByText('Вынести мусор', {}, { timeout: 6000 })).toBeInTheDocument()
    expect(api.listTasks).toHaveBeenCalledTimes(2)
  }, 10000)

  it('настоящая ошибка сервера по-прежнему показывается', async () => {
    vi.mocked(api.listTasks).mockReset().mockRejectedValue(new api.ApiError(500, 'internal_error'))
    renderTasks('mama')
    expect(await screen.findByText(/Не удалось загрузить задания/)).toBeInTheDocument()
  })
})

describe('повторяющиеся задания в «Предстоящих»', () => {
  it('список просят со сжатием серий: одно текущее вхождение на повторяющееся задание', async () => {
    renderTasks('mama')
    await screen.findByText('Вынести мусор')
    expect(api.listTasks).toHaveBeenCalledTimes(1)
    const [token, from, to, options] = vi.mocked(api.listTasks).mock.calls[0]
    expect(token).toBe('tok')
    expect(to > from).toBe(true)
    expect(options).toEqual({ collapse: true })
  })
})
