import { render, screen } from '@testing-library/react'
import { Provider } from 'react-redux'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { makeStore } from '@/store'
import { setSession } from '@/store/session'
import * as api from '@/api'
import type { Member } from '@/api'
import { ConfirmProvider } from '@/components/ConfirmDialog'
import { IdentityContext } from '@/identity/context'
import type { Identity } from '@/identity/types'
import Tasks from '@/pages/Tasks'
import TaskForm from '@/pages/TaskForm'
import { ProfileContext } from '@/profile/context'

vi.mock('@/api', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/api')>()), listTasks: vi.fn(), listDoneTasks: vi.fn() }))

const members: Member[] = [
  { id: 'mama', name: 'Лена', role: 'mama', avatar: null, isOwner: true },
  { id: 'kid', name: 'Миша', role: 'child', avatar: null, isOwner: false },
  { id: 'sis', name: 'Аня', role: 'child', avatar: null, isOwner: false },
]

function renderApp(path: string) {
  const identity: Identity = { familyCode: 'c', memberId: 'mama', name: 'Лена', role: 'mama', token: 'tok' }
  return render(
    <Provider store={makeStore({ hydrate: false })}>
    <IdentityContext.Provider value={{ identity, save: async () => {}, clear: async () => {} }}>
      <ProfileContext.Provider value={{ data: { me: { ...members[0], email: 'x@y.z' }, members }, failed: false }}>
        <ConfirmProvider>
          <MemoryRouter initialEntries={[path]}>
            <Routes>
              <Route path="/tasks" element={<Tasks />} />
              <Route path="/tasks/new" element={<TaskForm />} />
            </Routes>
          </MemoryRouter>
        </ConfirmProvider>
      </ProfileContext.Provider>
    </IdentityContext.Provider>
    </Provider>,
  )
}

beforeEach(() => {
  setSession({ token: 'tok', memberId: 'm1' })
  vi.mocked(api.listTasks).mockReset().mockResolvedValue({ tasks: [], occurrences: [] })
})

describe('кнопка «Новая задача» учитывает фильтр по человеку', () => {
  const addLink = () => screen.getByRole('link', { name: /Новая задача/ })

  it('без фильтра ссылка без исполнителя', async () => {
    renderApp('/tasks')
    await screen.findByText(/Предстоящих заданий нет/)
    expect(addLink()).toHaveAttribute('href', '/tasks/new')
  })

  it('выбран другой человек: исполнитель в ссылке', async () => {
    renderApp('/tasks')
    await userEvent.click(await screen.findByRole('button', { name: 'Миша' }))
    expect(addLink()).toHaveAttribute('href', '/tasks/new?assignee=kid')
  })

  it('«Мои»: исполнитель я; «Все» возвращает обычную ссылку', async () => {
    renderApp('/tasks')
    await userEvent.click(await screen.findByRole('button', { name: 'Мои' }))
    expect(addLink()).toHaveAttribute('href', '/tasks/new?assignee=mama')
    await userEvent.click(screen.getByRole('button', { name: 'Все' }))
    expect(addLink()).toHaveAttribute('href', '/tasks/new')
  })
})

describe('форма нового задания: исполнитель из адреса', () => {
  const assignee = () => screen.getByLabelText('Кому') as HTMLSelectElement

  it('подставляет выбранного участника', () => {
    renderApp('/tasks/new?assignee=kid')
    expect(assignee().value).toBe('kid')
  })

  it('без параметра исполнитель я', () => {
    renderApp('/tasks/new')
    expect(assignee().value).toBe('mama')
  })

  it('чужой или неизвестный id игнорируется: исполнитель я', () => {
    renderApp('/tasks/new?assignee=ghost')
    expect(assignee().value).toBe('mama')
  })

  it('выбор можно сменить вручную', async () => {
    renderApp('/tasks/new?assignee=kid')
    await userEvent.selectOptions(assignee(), 'sis')
    expect(assignee().value).toBe('sis')
  })
})
