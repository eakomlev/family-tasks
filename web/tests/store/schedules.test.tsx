import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Provider } from 'react-redux'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as api from '@/api'
import type { Lesson, Member, Training } from '@/api'
import { IdentityContext } from '@/identity/context'
import { FamilyLessons } from '@/pages/MyDay/components/FamilyLessons'
import { ProfileContext } from '@/profile/context'
import { RealtimeContext } from '@/realtime/context'
import type { Listener } from '@/realtime/types'
import { makeStore } from '@/store'
import { RealtimeBridge } from '@/store/RealtimeBridge'
import { useGetScheduleQuery, useSaveScheduleMutation } from '@/store/schedules'
import { setSession } from '@/store/session'

vi.mock('@/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/api')>()),
  getSchedule: vi.fn(),
  getTrainings: vi.fn(),
  saveSchedule: vi.fn(),
  listTasks: vi.fn(),
}))

const lesson = (subject: string): Lesson => ({ weekday: 1, subject, startsAt: null, endsAt: null, room: null })
const training = (title: string): Training => ({ weekday: 2, title, place: null, startsAt: null, endsAt: null })

const mama: Member = { id: 'mama', name: 'Лена', role: 'mama', avatar: null, isOwner: true }
const misha: Member = { id: 'misha', name: 'Миша', role: 'child', avatar: null, isOwner: false }
const anya: Member = { id: 'anya', name: 'Аня', role: 'child', avatar: null, isOwner: false }

beforeEach(() => {
  localStorage.clear()
  setSession({ token: 'tok', memberId: 'mama' })
  vi.mocked(api.getSchedule).mockReset().mockImplementation(async (_t, id) => ({ lessons: [lesson(`Математика ${id}`)] }))
  vi.mocked(api.getTrainings).mockReset().mockImplementation(async (_t, id) => ({ trainings: [training(`Плавание ${id}`)] }))
  vi.mocked(api.saveSchedule).mockReset().mockResolvedValue(undefined)
  vi.mocked(api.listTasks).mockReset().mockResolvedValue({ tasks: [], occurrences: [] })
})

describe('расписания через кэш', () => {
  it('«Мой день» родителя: расписание и тренировки каждого ребёнка запрашиваются по одному разу', async () => {
    const identity = { familyCode: 'c', memberId: 'mama', name: 'Лена', role: 'mama' as const, token: 'tok' }
    render(
      <Provider store={makeStore({ hydrate: false })}>
        <IdentityContext.Provider value={{ identity, save: async () => {}, clear: async () => {} }}>
          <ProfileContext.Provider value={{ data: { me: { ...mama, email: 'x@y.z' }, members: [mama, misha, anya] }, failed: false, refresh: async () => {} }}>
            <MemoryRouter><FamilyLessons now={new Date(2026, 9, 12, 10)} /></MemoryRouter>
          </ProfileContext.Provider>
        </IdentityContext.Provider>
      </Provider>,
    )
    await screen.findByText(/Математика misha/)
    await screen.findByText(/Математика anya/)
    expect(api.getSchedule).toHaveBeenCalledTimes(2)
    expect(api.getTrainings).toHaveBeenCalledTimes(2)
    expect(vi.mocked(api.getSchedule).mock.calls.map((c) => c[1]).sort()).toEqual(['anya', 'misha'])
  })

  it('сохранение показывается сразу, ещё до ответа сервера; сохранение одного ребёнка другого не трогает', async () => {
    let finish!: () => void
    vi.mocked(api.saveSchedule).mockImplementation(() => new Promise<void>((resolve) => (finish = resolve)))
    function Probe() {
      const a = useGetScheduleQuery('misha')
      const b = useGetScheduleQuery('anya')
      const [save] = useSaveScheduleMutation()
      return (
        <div>
          <p data-testid="a">{a.data?.lessons.map((l) => l.subject).join()}</p>
          <p data-testid="b">{b.data?.lessons.map((l) => l.subject).join()}</p>
          <button onClick={() => void save({ memberId: 'misha', lessons: [lesson('Химия')] })}>save</button>
        </div>
      )
    }
    render(<Provider store={makeStore({ hydrate: false })}><Probe /></Provider>)
    await waitFor(() => expect(screen.getByTestId('a')).toHaveTextContent('Математика misha'))
    await userEvent.click(screen.getByText('save'))
    // сервер ещё не ответил, а экран уже показывает новое
    expect(screen.getByTestId('a')).toHaveTextContent('Химия')
    act(() => finish())
    await waitFor(() => expect(api.getSchedule).toHaveBeenCalledTimes(3))
    // у другого ребёнка запрос не повторялся
    expect(vi.mocked(api.getSchedule).mock.calls.filter((c) => c[1] === 'anya')).toHaveLength(1)
  })

  it('ошибка сохранения откатывает показанное', async () => {
    vi.mocked(api.saveSchedule).mockRejectedValue(new api.ApiError(500, 'boom'))
    function Probe() {
      const a = useGetScheduleQuery('misha')
      const [save] = useSaveScheduleMutation()
      return (
        <div>
          <p data-testid="a">{a.data?.lessons.map((l) => l.subject).join()}</p>
          <button onClick={() => void save({ memberId: 'misha', lessons: [lesson('Химия')] })}>save</button>
        </div>
      )
    }
    render(<Provider store={makeStore({ hydrate: false })}><Probe /></Provider>)
    await waitFor(() => expect(screen.getByTestId('a')).toHaveTextContent('Математика misha'))
    await userEvent.click(screen.getByText('save'))
    await waitFor(() => expect(screen.getByTestId('a')).toHaveTextContent('Математика misha'))
  })

  it('сигнал сокета schedule обновляет расписания (через кэш), на экране новое', async () => {
    const listeners = new Set<Listener>()
    let subject = 'Математика'
    vi.mocked(api.getSchedule).mockImplementation(async () => ({ lessons: [lesson(subject)] }))
    function Probe() {
      const a = useGetScheduleQuery('misha')
      return <p data-testid="a">{a.data?.lessons.map((l) => l.subject).join()}</p>
    }
    render(
      <Provider store={makeStore({ hydrate: false })}>
        <RealtimeContext.Provider value={{ subscribe: (l) => (listeners.add(l), () => void listeners.delete(l)), setViewing: () => {} }}>
          <RealtimeBridge />
          <Probe />
        </RealtimeContext.Provider>
      </Provider>,
    )
    await waitFor(() => expect(screen.getByTestId('a')).toHaveTextContent('Математика'))
    subject = 'Физика'
    act(() => listeners.forEach((l) => l({ type: 'schedule', memberId: 'misha' })))
    await waitFor(() => expect(screen.getByTestId('a')).toHaveTextContent('Физика'))
  })
})
