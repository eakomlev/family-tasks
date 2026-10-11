import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as api from '@/api'
import type { Member, Occurrence, Task } from '@/api'
import { IdentityContext } from '@/identity/context'
import { ProfileContext } from '@/profile/context'
import TaskView from '@/pages/TaskView'
import { occ, task } from '../helpers'

vi.mock('@/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/api')>()),
  getTask: vi.fn(),
  completeTask: vi.fn(),
  uncompleteTask: vi.fn(),
}))

const members: Member[] = [
  { id: 'm1', name: 'Лена', role: 'mama', avatar: null, isOwner: true },
  { id: 'm2', name: 'Миша', role: 'child', avatar: null, isOwner: false },
]

function renderView(me: Member, loaded: { task: Task; occurrence: Occurrence | null }, url = '/tasks/a?date=2026-10-12') {
  vi.mocked(api.getTask).mockResolvedValue(loaded)
  const identity = { familyCode: 'c', memberId: me.id, name: me.name, role: me.role, token: 'tok' }
  render(
    <IdentityContext.Provider value={{ identity, save: async () => {}, clear: async () => {} }}>
      <ProfileContext.Provider value={{ data: { me: { ...me, email: 'x@y.z' }, members }, failed: false, refresh: async () => {} }}>
        <MemoryRouter initialEntries={[url]}>
          <Routes>
            <Route path="/tasks/:taskId" element={<TaskView />} />
            <Route path="/tasks" element={<p>Список заданий</p>} />
            <Route path="/tasks/:taskId/edit" element={<p>Форма изменения</p>} />
          </Routes>
        </MemoryRouter>
      </ProfileContext.Provider>
    </IdentityContext.Provider>,
  )
}

const base = task({ id: 'a', title: 'Вынести мусор', description: 'Пакеты у двери.\nНе забыть ведро.', authorId: 'm1', assigneeId: 'm2', date: '2026-10-12', time: '18:00' })

beforeEach(() => {
  vi.mocked(api.getTask).mockReset()
  vi.mocked(api.completeTask).mockReset().mockResolvedValue(undefined)
  vi.mocked(api.uncompleteTask).mockReset().mockResolvedValue(undefined)
})

describe('страница задания', () => {
  it('показывает все детали и запрашивает нужное вхождение', async () => {
    renderView(members[1], { task: base, occurrence: occ('a', '2026-10-12') })
    expect(await screen.findByRole('heading', { name: 'Вынести мусор' })).toBeInTheDocument()
    expect(api.getTask).toHaveBeenCalledWith('tok', 'a', '2026-10-12')
    expect(screen.getByText(/Пакеты у двери\./)).toBeInTheDocument()
    expect(screen.getByText('Миша (я)')).toBeInTheDocument()
    expect(screen.getByText('Лена')).toBeInTheDocument()
    expect(screen.getByText('12 октября в 18:00')).toBeInTheDocument()
    // createdAt из helpers: 2026-10-11 10:00 UTC, часовой пояс тестов Москва
    expect(screen.getByText('11 октября, 13:00')).toBeInTheDocument()
  })

  it('награда в деталях и в поздравлении только у самого исполнителя', async () => {
    const user = userEvent.setup()
    const rewarded = task({ ...base, reward: 20 })

    // исполнитель (Миша) выполняет: в поздравлении видно, сколько получил
    renderView(members[1], { task: rewarded, occurrence: occ('a', '2026-10-12') })
    expect(await screen.findByText('20 монет')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Отметить выполненным' }))
    expect(await screen.findByText('+20 монет')).toBeInTheDocument()
  })

  it('когда отмечает не исполнитель, в поздравлении монет нет, а в деталях награда есть', async () => {
    const user = userEvent.setup()
    renderView(members[0], { task: task({ ...base, reward: 20 }), occurrence: occ('a', '2026-10-12') })
    expect(await screen.findByText('20 монет')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Отметить выполненным' }))
    await screen.findByText('Задание «Вынести мусор» выполнено.')
    expect(screen.queryByText('+20 монет')).not.toBeInTheDocument()
  })

  it('без описания блока описания нет, повтор подписан', async () => {
    const t = task({ ...base, description: '', repeat: { type: 'daily', days: [], until: '2026-12-01' } })
    renderView(members[1], { task: t, occurrence: occ('a', '2026-10-12') })
    await screen.findByRole('heading', { name: 'Вынести мусор' })
    expect(screen.queryByText(/Пакеты/)).not.toBeInTheDocument()
    expect(screen.getByText('каждый день до 1 декабря')).toBeInTheDocument()
  })

  it('«Изменить» только у автора', async () => {
    renderView(members[1], { task: base, occurrence: occ('a', '2026-10-12') })
    await screen.findByRole('heading', { name: 'Вынести мусор' })
    expect(screen.queryByRole('link', { name: 'Изменить' })).not.toBeInTheDocument()
  })

  it('автору «Изменить» ведёт на форму', async () => {
    renderView(members[0], { task: base, occurrence: occ('a', '2026-10-12') })
    await userEvent.click(await screen.findByRole('link', { name: 'Изменить' }))
    expect(await screen.findByText('Форма изменения')).toBeInTheDocument()
  })

  it('отметка выполнения: запрос на сервер и экран поздравления; закрытие ведёт к списку', async () => {
    const user = userEvent.setup()
    renderView(members[1], { task: base, occurrence: occ('a', '2026-10-12') })
    await user.click(await screen.findByRole('button', { name: 'Отметить выполненным' }))

    expect(api.completeTask).toHaveBeenCalledWith('tok', 'a', '2026-10-12')
    expect(await screen.findByText('Задание «Вынести мусор» выполнено.')).toBeInTheDocument()
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Отлично' }))
    expect(await screen.findByText('Список заданий')).toBeInTheDocument()
  })

  it('при ошибке поздравления нет, показано сообщение', async () => {
    vi.mocked(api.completeTask).mockRejectedValue(new api.ApiError(500, 'x'))
    const user = userEvent.setup()
    renderView(members[1], { task: base, occurrence: occ('a', '2026-10-12') })
    await user.click(await screen.findByRole('button', { name: 'Отметить выполненным' }))
    expect(await screen.findByText(/Не удалось изменить отметку/)).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Отметить выполненным' })).toBeEnabled()
  })

  it('выполненное: кто и когда, отметку можно снять, без поздравления', async () => {
    const user = userEvent.setup()
    renderView(members[1], { task: base, occurrence: occ('a', '2026-10-12', true) })
    expect(await screen.findByText(/Выполнено: Лена, 11 октября, 13:00/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Снять отметку о выполнении' }))
    expect(api.uncompleteTask).toHaveBeenCalledWith('tok', 'a', '2026-10-12')
    await waitFor(() => expect(screen.getByRole('button', { name: 'Отметить выполненным' })).toBeInTheDocument())
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('если такого вхождения нет, кнопки выполнения нет', async () => {
    renderView(members[1], { task: base, occurrence: null })
    await screen.findByRole('heading', { name: 'Вынести мусор' })
    expect(screen.queryByRole('button', { name: /выполн/i })).not.toBeInTheDocument()
  })

  it('неизвестное задание ведёт к списку', async () => {
    vi.mocked(api.getTask).mockRejectedValue(new api.ApiError(404, 'task_not_found'))
    const identity = { familyCode: 'c', memberId: 'm2', name: 'Миша', role: 'child' as const, token: 'tok' }
    render(
      <IdentityContext.Provider value={{ identity, save: async () => {}, clear: async () => {} }}>
        <ProfileContext.Provider value={{ data: { me: { ...members[1], email: 'x@y.z' }, members }, failed: false, refresh: async () => {} }}>
          <MemoryRouter initialEntries={['/tasks/zzz']}>
            <Routes>
              <Route path="/tasks/:taskId" element={<TaskView />} />
              <Route path="/tasks" element={<p>Список заданий</p>} />
            </Routes>
          </MemoryRouter>
        </ProfileContext.Provider>
      </IdentityContext.Provider>,
    )
    expect(await screen.findByText('Список заданий')).toBeInTheDocument()
  })
})
