import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Provider } from 'react-redux'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as api from '@/api'
import type { Member } from '@/api'
import { IdentityContext } from '@/identity/context'
import { ProfileContext } from '@/profile/context'
import { TaskBadgeProvider } from '@/tasks'
import { useTaskBadge } from '@/tasks/context'
import { TodayTasks } from '@/pages/MyDay/components/TodayTasks'
import { PendingReview } from '@/components/PendingReview'
import { makeStore } from '@/store'
import { ownerChanged } from '@/store/cache'
import { saveCache } from '@/store/persist'
import { setSession } from '@/store/session'
import { tasksApi, useCompleteTaskMutation, useListTasksQuery } from '@/store/tasks'
import { occ, task } from '../helpers'

vi.mock('@/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/api')>()),
  listTasks: vi.fn(),
  listPendingTasks: vi.fn(),
  completeTask: vi.fn(),
}))

const NOW = new Date(2026, 9, 11, 10)
const mama: Member = { id: 'm1', name: 'Лена', role: 'mama', avatar: null, isOwner: true }
const identity = { familyCode: 'c', memberId: 'm1', name: 'Лена', role: 'mama' as const, token: 'tok' }

const list = () => ({ tasks: [task({ id: 'a', title: 'Вынести мусор', assigneeId: 'm1' })], occurrences: [occ('a', '2026-10-11')] })

function Badge() {
  return <p data-testid="badge">{useTaskBadge()}</p>
}

function renderAll(store = makeStore({ hydrate: false })) {
  return render(
    <Provider store={store}>
      <IdentityContext.Provider value={{ identity, save: async () => {}, clear: async () => {} }}>
        <ProfileContext.Provider value={{ data: { me: { ...mama, email: 'x@y.z' }, members: [mama] }, failed: false, refresh: async () => {} }}>
          <MemoryRouter>
            <TaskBadgeProvider>
              <Badge />
              <TodayTasks now={NOW} />
              <PendingReview />
            </TaskBadgeProvider>
          </MemoryRouter>
        </ProfileContext.Provider>
      </IdentityContext.Provider>
    </Provider>,
  )
}

// «сегодня» везде одно и то же (в значке таба оно берётся из часов, а не из пропса), иначе запросы разных экранов отличались бы датой
beforeEach(() => {
  vi.setSystemTime(NOW)
  localStorage.clear()
  setSession({ token: 'tok', memberId: 'm1' })
  vi.mocked(api.listTasks).mockReset().mockImplementation(async () => list())
  vi.mocked(api.listPendingTasks).mockReset().mockResolvedValue({ tasks: [], occurrences: [] })
  vi.mocked(api.completeTask).mockReset().mockResolvedValue(undefined)
})

afterEach(() => vi.useRealTimers())

describe('задания через кэш RTK Query', () => {
  it('одинаковые запросы разных экранов объединяются: значок таба, «Задания на сегодня» и блок проверки делают по одному запросу', async () => {
    renderAll()
    await screen.findByText('Вынести мусор')
    await waitFor(() => expect(screen.getByTestId('badge')).toHaveTextContent('1'))
    expect(api.listTasks).toHaveBeenCalledTimes(1)
    expect(api.listPendingTasks).toHaveBeenCalledTimes(1)
  })

  it('значок таба считается из тех же загруженных данных', async () => {
    renderAll()
    await waitFor(() => expect(screen.getByTestId('badge')).toHaveTextContent('1'))
  })

  it('после перезапуска список заданий виден на первом кадре из сохранённого, свежий приходит следом', async () => {
    const first = makeStore({ hydrate: false })
    const sub = first.dispatch(tasksApi.endpoints.listTasks.initiate({ from: '2026-10-11', to: '2026-10-11' }))
    await sub
    first.dispatch(ownerChanged('m1'))
    const state = first.getState().api
    const key = Object.keys(state.queries)[0]
    // состарим запись, чтобы при открытии экран запросил свежие данные
    saveCache('m1', { queries: { [key]: { ...state.queries[key], fulfilledTimeStamp: Date.now() - 120_000 } }, provided: state.provided })
    sub.unsubscribe()

    let finish!: () => void
    vi.mocked(api.listTasks).mockImplementation(() => new Promise((resolve) => (finish = () => resolve({ tasks: [task({ id: 'a', title: 'Новое название', assigneeId: 'm1' })], occurrences: [occ('a', '2026-10-11')] }))))
    renderAll(makeStore())
    // сразу: из сохранённого, а запрос ещё не завершился
    expect(screen.getByText('Вынести мусор')).toBeInTheDocument()
    finish()
    await screen.findByText('Новое название')
  })

  it('мутация сбрасывает кэш заданий: список обновляется сам', async () => {
    function Probe() {
      const { data } = useListTasksQuery({ from: '2026-10-11', to: '2026-10-11' })
      const [complete] = useCompleteTaskMutation()
      return (
        <div>
          <p data-testid="done">{data?.occurrences[0]?.done ? 'да' : 'нет'}</p>
          <button onClick={() => void complete({ id: 'a', date: '2026-10-11' })}>complete</button>
        </div>
      )
    }
    let calls = 0
    vi.mocked(api.listTasks).mockImplementation(async () => ({ tasks: list().tasks, occurrences: [occ('a', '2026-10-11', ++calls > 1)] }))
    render(<Provider store={makeStore({ hydrate: false })}><Probe /></Provider>)
    await waitFor(() => expect(screen.getByTestId('done')).toHaveTextContent('нет'))
    await userEvent.click(screen.getByText('complete'))
    await waitFor(() => expect(screen.getByTestId('done')).toHaveTextContent('да'))
    expect(api.completeTask).toHaveBeenCalledWith('tok', 'a', '2026-10-11')
    expect(api.listTasks).toHaveBeenCalledTimes(2)
  })

  it('ошибка запроса не стирает показанные данные', async () => {
    const store = makeStore({ hydrate: false })
    renderAll(store)
    await screen.findByText('Вынести мусор')
    vi.mocked(api.listTasks).mockRejectedValue(new api.ApiError(500, 'boom'))
    await store.dispatch(tasksApi.util.invalidateTags(['Tasks']))
    await new Promise((r) => setTimeout(r, 50))
    expect(screen.getByText('Вынести мусор')).toBeInTheDocument()
  })
})
