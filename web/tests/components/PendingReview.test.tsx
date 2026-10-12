import { act, render, screen, waitFor, within } from '@testing-library/react'
import { Provider } from 'react-redux'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { makeStore } from '@/store'
import { RealtimeBridge } from '@/store/RealtimeBridge'
import { setSession } from '@/store/session'
import * as api from '@/api'
import type { Member } from '@/api'
import { PendingReview } from '@/components/PendingReview'
import { TaskItem } from '@/components/TaskItem'
import { IdentityContext } from '@/identity/context'
import type { Identity } from '@/identity/types'
import { ProfileContext } from '@/profile/context'
import { RealtimeContext } from '@/realtime/context'
import type { Listener } from '@/realtime/types'
import { buildSections } from '@/pages/Tasks/utils'
import { occ, task } from '../helpers'

vi.mock('@/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/api')>()),
  listPendingTasks: vi.fn(),
  confirmTask: vi.fn(),
  uncompleteTask: vi.fn(),
}))

const members: Member[] = [
  { id: 'mama', name: 'Лена', role: 'mama', avatar: null, isOwner: true },
  { id: 'kid', name: 'Миша', role: 'child', avatar: null, isOwner: false },
  { id: 'sis', name: 'Аня', role: 'child', avatar: null, isOwner: false },
]

const pendingList = () => ({
  tasks: [
    task({ id: 'a', title: 'Убрать комнату', assigneeId: 'kid', authorId: 'mama', reward: 20, date: '2026-10-11' }),
    task({ id: 'b', title: 'Вынести мусор', assigneeId: 'sis', authorId: 'mama', reward: 5, date: null }),
  ],
  occurrences: [occ('a', '2026-10-11', false, true), occ('b', null, false, true)],
})

function renderBlock(props: Parameters<typeof PendingReview>[0] = {}, role: Identity['role'] = 'mama', listeners = new Set<Listener>()) {
  const me = role === 'child' ? members[1] : members[0]
  const identity: Identity = { familyCode: 'c', memberId: me.id, name: me.name, role, token: 'tok' }
  render(
    <Provider store={makeStore({ hydrate: false })}>
    <RealtimeContext.Provider value={{ subscribe: (l) => (listeners.add(l), () => void listeners.delete(l)), setViewing: () => {} }}>
    <RealtimeBridge />
      <IdentityContext.Provider value={{ identity, save: async () => {}, clear: async () => {} }}>
        <ProfileContext.Provider value={{ data: { me: { ...me, email: 'x@y.z' }, members }, failed: false }}>
          <MemoryRouter><PendingReview {...props} /></MemoryRouter>
        </ProfileContext.Provider>
      </IdentityContext.Provider>
    </RealtimeContext.Provider>
    </Provider>,
  )
  return listeners
}

beforeEach(() => {
  setSession({ token: 'tok', memberId: 'm1' })
  vi.mocked(api.listPendingTasks).mockReset().mockResolvedValue(pendingList())
  vi.mocked(api.confirmTask).mockReset().mockResolvedValue(undefined)
  vi.mocked(api.uncompleteTask).mockReset().mockResolvedValue(undefined)
})

describe('блок «Ждут подтверждения»', () => {
  it('родителю: заголовок со счётчиком и карточки детей с кнопками', async () => {
    renderBlock()
    expect(await screen.findByText('Убрать комнату')).toBeInTheDocument()
    expect(screen.getByLabelText('Заданий: 2')).toHaveTextContent('2')
    expect(screen.getByText('Вынести мусор')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /Подтвердить/ })).toHaveLength(2)
    expect(screen.getAllByRole('button', { name: 'Вернуть' })).toHaveLength(2)
    // сколько получит ребёнок видно на кнопке
    expect(screen.getByRole('button', { name: 'Подтвердить: +20' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Подтвердить: +5' })).toBeInTheDocument()
  })

  it('«Подтвердить» отправляет подтверждение именно этого вхождения и обновляет список', async () => {
    const user = userEvent.setup()
    renderBlock()
    await screen.findByText('Убрать комнату')
    vi.mocked(api.listPendingTasks).mockResolvedValue({ tasks: [pendingList().tasks[1]], occurrences: [pendingList().occurrences[1]] })
    await user.click(screen.getByRole('button', { name: 'Подтвердить: +20' }))
    expect(api.confirmTask).toHaveBeenCalledWith('tok', 'a', '2026-10-11')
    await waitFor(() => expect(screen.queryByText('Убрать комнату')).not.toBeInTheDocument())
    expect(screen.getByText('Вынести мусор')).toBeInTheDocument()
  })

  it('«Вернуть» снимает отправку (uncomplete), монет не выдаёт', async () => {
    const user = userEvent.setup()
    renderBlock()
    await screen.findByText('Вынести мусор')
    await user.click(within(screen.getByText('Вынести мусор').closest('li')!).getByRole('button', { name: 'Вернуть' }))
    expect(api.uncompleteTask).toHaveBeenCalledWith('tok', 'b', null)
    expect(api.confirmTask).not.toHaveBeenCalled()
  })

  it('когда проверять нечего, блока нет; по сигналу сокета он появляется сам', async () => {
    vi.mocked(api.listPendingTasks).mockResolvedValueOnce({ tasks: [], occurrences: [] })
    const listeners = renderBlock()
    await waitFor(() => expect(api.listPendingTasks).toHaveBeenCalledTimes(1))
    expect(screen.queryByText('Ждут подтверждения')).not.toBeInTheDocument()

    act(() => listeners.forEach((l) => l({ type: 'tasks' })))
    expect(await screen.findByText('Убрать комнату')).toBeInTheDocument()
  })

  it('фильтр по исполнителю: только задания этого ребёнка; число заданий сообщается странице', async () => {
    const onCount = vi.fn()
    renderBlock({ assigneeId: 'sis', onCount })
    await screen.findByText('Вынести мусор')
    expect(screen.queryByText('Убрать комнату')).not.toBeInTheDocument()
    await waitFor(() => expect(onCount).toHaveBeenLastCalledWith(1))
  })

  it('ошибка действия показывается, список остаётся', async () => {
    vi.mocked(api.confirmTask).mockRejectedValue(new api.ApiError(500, 'x'))
    const user = userEvent.setup()
    renderBlock()
    await user.click(await screen.findByRole('button', { name: 'Подтвердить: +20' }))
    expect(await screen.findByText(/Не удалось выполнить/)).toBeInTheDocument()
    expect(screen.getByText('Убрать комнату')).toBeInTheDocument()
  })

  it('у ребёнка блока нет и запроса нет', () => {
    renderBlock({}, 'child')
    expect(api.listPendingTasks).not.toHaveBeenCalled()
    expect(screen.queryByText('Ждут подтверждения')).not.toBeInTheDocument()
  })
})

describe('карточка «на проверке»', () => {
  const entry = { task: task({ id: 'a', title: 'Убрать', reward: 20, date: '2026-10-09' }), occurrence: occ('a', '2026-10-09', false, true) }
  const show = (review?: Parameters<typeof TaskItem>[0]['review']) =>
    render(<MemoryRouter><TaskItem task={entry.task} occurrence={entry.occurrence} today="2026-10-11" review={review} /></MemoryRouter>)

  it('без кнопок: состояние «на проверке», не просрочено; подпись для ребёнка', () => {
    show()
    const link = screen.getByRole('link')
    expect(link).toHaveAccessibleName(/^На проверке:\s*Убрать/)
    expect(link).toHaveTextContent('Ждёт подтверждения родителей')
    expect(link).not.toHaveTextContent('Просрочено')
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('с кнопками для родителя: ссылка отдельно, кнопки не внутри ссылки', async () => {
    const onConfirm = vi.fn()
    const onReject = vi.fn()
    show({ onConfirm, onReject })
    const link = screen.getByRole('link')
    const confirmBtn = screen.getByRole('button', { name: 'Подтвердить: +20' })
    expect(link).not.toContainElement(confirmBtn)
    await userEvent.click(confirmBtn)
    await userEvent.click(screen.getByRole('button', { name: 'Вернуть' }))
    expect(onConfirm).toHaveBeenCalledTimes(1)
    expect(onReject).toHaveBeenCalledTimes(1)
  })

  it('пока идёт запрос, кнопки заблокированы', () => {
    show({ onConfirm: vi.fn(), onReject: vi.fn(), busy: true })
    expect(screen.getByRole('button', { name: /Подтвердить/ })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Вернуть' })).toBeDisabled()
  })
})

describe('buildSections: ожидающие проверки', () => {
  const list = { tasks: [task({ id: 'a', title: 'A' }), task({ id: 'b', title: 'B' })], occurrences: [occ('a', '2026-10-11'), occ('b', '2026-10-11', false, true)] }
  it('по умолчанию в списке; у родителя (hidePending) их нет, они в отдельном блоке', () => {
    expect(buildSections(list, '2026-10-11', null)[0].items.map((i) => i.task.id)).toEqual(['a', 'b'])
    expect(buildSections(list, '2026-10-11', null, { hidePending: true })[0].items.map((i) => i.task.id)).toEqual(['a'])
  })
  it('если кроме ожидающих ничего нет, секций нет', () => {
    const only = { tasks: [list.tasks[1]], occurrences: [list.occurrences[1]] }
    expect(buildSections(only, '2026-10-11', null, { hidePending: true })).toEqual([])
  })
})
