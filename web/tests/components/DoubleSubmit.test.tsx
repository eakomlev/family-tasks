import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react'
import { Provider } from 'react-redux'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as api from '@/api'
import type { Member } from '@/api'
import { ConfirmProvider } from '@/components/ConfirmDialog'
import { makeStore } from '@/store'
import { setSession } from '@/store/session'
import { IdentityContext } from '@/identity/context'
import { useReview } from '@/lib/useReview'
import { Composer } from '@/pages/ChatRoom/components/Composer'
import GoalForm from '@/pages/GoalForm'
import { ProfileForm } from '@/pages/ProfileEdit/components/ProfileForm'
import TaskView from '@/pages/TaskView'
import { TaskEditor } from '@/pages/TaskForm/components/TaskEditor'
import { emptyForm } from '@/pages/TaskForm/utils'
import { ProfileContext } from '@/profile/context'
import { RealtimeContext } from '@/realtime/context'
import { occ, task } from '../helpers'

vi.mock('@/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/api')>()),
  getTask: vi.fn(),
  completeTask: vi.fn(),
  uncompleteTask: vi.fn(),
  confirmTask: vi.fn(),
  createGoal: vi.fn(),
}))

// Два нажатия подряд в одном «тике»: React не успевает перерисовать кнопку между ними,
// поэтому защита только через disabled от состояния не сработала бы.
const twice = (el: HTMLElement) =>
  act(() => {
    fireEvent.click(el)
    fireEvent.click(el)
  })

// запрос, который не завершается, пока мы не скажем (имитация медленной сети)
const slow = () => {
  let finish!: () => void
  const promise = new Promise<void>((resolve) => (finish = resolve))
  return { promise, finish }
}

const members: Member[] = [
  { id: 'm1', name: 'Лена', role: 'mama', avatar: null, isOwner: true },
  { id: 'm2', name: 'Миша', role: 'child', avatar: null, isOwner: false },
]

beforeEach(() => {
  setSession({ token: 'tok', memberId: 'm1' })
  vi.mocked(api.completeTask).mockReset()
  vi.mocked(api.confirmTask).mockReset()
  vi.mocked(api.uncompleteTask).mockReset()
  vi.mocked(api.createGoal).mockReset()
})

describe('TaskView: отметка и отправка на проверку', () => {
  function renderView(me: Member, pending: boolean) {
    const t = task({ id: 'a', title: 'Вынести мусор', authorId: 'm1', assigneeId: 'm2', date: '2026-10-12', reward: 20 })
    vi.mocked(api.getTask).mockResolvedValue({ task: t, occurrence: occ('a', '2026-10-12', false, pending) })
    const identity = { familyCode: 'c', memberId: me.id, name: me.name, role: me.role, token: 'tok' }
    render(
      <Provider store={makeStore({ hydrate: false })}>
      <RealtimeContext.Provider value={{ subscribe: () => () => {}, setViewing: () => {} }}>
        <IdentityContext.Provider value={{ identity, save: async () => {}, clear: async () => {} }}>
          <ProfileContext.Provider value={{ data: { me: { ...me, email: 'x@y.z' }, members }, failed: false }}>
            <MemoryRouter initialEntries={['/tasks/a?date=2026-10-12']}>
              <Routes><Route path="/tasks/:taskId" element={<TaskView />} /></Routes>
            </MemoryRouter>
          </ProfileContext.Provider>
        </IdentityContext.Provider>
      </RealtimeContext.Provider>
      </Provider>,
    )
  }

  it('ребёнок: «Отправить на проверку» дважды подряд отправляет один запрос', async () => {
    const request = slow()
    vi.mocked(api.completeTask).mockReturnValue(request.promise)
    renderView(members[1], false)
    twice(await screen.findByRole('button', { name: 'Отправить на проверку' }))
    expect(api.completeTask).toHaveBeenCalledTimes(1)
    request.finish()
  })

  it('родитель: «Подтвердить» дважды подряд отправляет один запрос', async () => {
    const request = slow()
    vi.mocked(api.confirmTask).mockReturnValue(request.promise)
    renderView(members[0], true)
    twice(await screen.findByRole('button', { name: /Подтвердить/ }))
    expect(api.confirmTask).toHaveBeenCalledTimes(1)
    request.finish()
  })
})

describe('useReview: подтвердить и вернуть в списках', () => {
  it('повторное «Подтвердить» по тому же заданию, пока идёт запрос, игнорируется', async () => {
    const request = slow()
    vi.mocked(api.confirmTask).mockReturnValue(request.promise)
    const { result } = renderHook(() => useReview(), { wrapper: ({ children }) => <Provider store={makeStore({ hydrate: false })}>{children}</Provider> })
    const entry = { task: task({ id: 'a' }), occurrence: occ('a', '2026-10-12', false, true) }
    act(() => {
      void result.current.confirm(entry)
      void result.current.confirm(entry)
      void result.current.reject(entry)
    })
    expect(api.confirmTask).toHaveBeenCalledTimes(1)
    expect(api.uncompleteTask).not.toHaveBeenCalled()
    request.finish()
  })
})

describe('создание и сохранение', () => {
  it('TaskEditor: «Создать» дважды подряд вызывает onSubmit один раз', async () => {
    const request = slow()
    const onSubmit = vi.fn().mockReturnValue(request.promise)
    render(
      <ConfirmProvider>
        <TaskEditor initial={{ ...emptyForm('m1'), title: 'Новая задача' }} members={members} me="m1" submitLabel="Создать" onSubmit={onSubmit} />
      </ConfirmProvider>,
    )
    twice(screen.getByRole('button', { name: 'Создать' }))
    expect(onSubmit).toHaveBeenCalledTimes(1)
    request.finish()
  })

  it('Composer: Отправить дважды подряд отправляет сообщение один раз', async () => {
    const request = slow()
    const onSend = vi.fn().mockReturnValue(request.promise)
    const user = userEvent.setup()
    render(<Composer onSend={onSend} onUploadFile={vi.fn()} onUpload={vi.fn()} />)
    await user.type(screen.getByLabelText('Сообщение'), 'Привет')
    twice(screen.getByRole('button', { name: 'Отправить' }))
    expect(onSend).toHaveBeenCalledTimes(1)
    request.finish()
  })

  it('ProfileForm: «Сохранить» дважды подряд сохраняет один раз', async () => {
    const request = slow()
    const onSave = vi.fn().mockReturnValue(request.promise)
    const user = userEvent.setup()
    render(<ProfileForm name="Лена" onSave={onSave} />)
    await user.type(screen.getByLabelText('Имя'), 'а')
    twice(screen.getByRole('button', { name: 'Сохранить' }))
    expect(onSave).toHaveBeenCalledTimes(1)
    request.finish()
  })

  it('GoalForm: «Создать» дважды подряд создаёт одну цель', async () => {
    const request = slow()
    vi.mocked(api.createGoal).mockReturnValue(request.promise as never)
    const identity = { familyCode: 'c', memberId: 'm1', name: 'Лена', role: 'mama' as const, token: 'tok' }
    const user = userEvent.setup()
    render(
      <Provider store={makeStore({ hydrate: false })}>
      <IdentityContext.Provider value={{ identity, save: async () => {}, clear: async () => {} }}>
        <ProfileContext.Provider value={{ data: { me: { ...members[0], email: 'x@y.z' }, members }, failed: false }}>
          <ConfirmProvider>
            <MemoryRouter initialEntries={['/family/m2/goals/new']}>
              <Routes><Route path="/family/:memberId/goals/new" element={<GoalForm />} /></Routes>
            </MemoryRouter>
          </ConfirmProvider>
        </ProfileContext.Provider>
      </IdentityContext.Provider>
      </Provider>,
    )
    await user.type(screen.getByLabelText('Название'), 'Лего')
    await user.type(screen.getByLabelText('Цена в монетах'), '300')
    twice(screen.getByRole('button', { name: 'Создать' }))
    expect(api.createGoal).toHaveBeenCalledTimes(1)
    request.finish()
    await waitFor(() => expect(api.createGoal).toHaveBeenCalledTimes(1))
  })
})
