import { cleanup, render, screen, within } from '@testing-library/react'
import { Provider } from 'react-redux'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as api from '@/api'
import type { Member } from '@/api'
import { IdentityContext } from '@/identity/context'
import MyDay from '@/pages/MyDay'
import { ProfileContext } from '@/profile/context'
import { makeStore } from '@/store'
import { setSession } from '@/store/session'

vi.mock('@/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/api')>()),
  listTasks: vi.fn(),
  listPendingTasks: vi.fn(),
  getSchedule: vi.fn(),
  getTrainings: vi.fn(),
}))

const mama: Member = { id: 'mama', name: 'Лена', role: 'mama', avatar: null, isOwner: true }

beforeEach(() => {
  setSession({ token: 'tok', memberId: 'mama' })
  vi.mocked(api.listTasks).mockResolvedValue({ tasks: [], occurrences: [] })
  vi.mocked(api.listPendingTasks).mockResolvedValue({ tasks: [], occurrences: [] })
  vi.mocked(api.getSchedule).mockResolvedValue({ lessons: [] })
  vi.mocked(api.getTrainings).mockResolvedValue({ trainings: [] })
  // 12 октября 2026, полдень
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-12T09:00:00Z'))
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('«Мой день»: календарь', () => {
  it('слева вверху значок календаря с сегодняшним числом ведёт на /calendar, значок времени суток справа от приветствия', () => {
    const identity = { familyCode: 'c', memberId: 'mama', name: 'Лена', role: 'mama' as const, token: 'tok' }
    render(
      <Provider store={makeStore({ hydrate: false })}>
        <IdentityContext.Provider value={{ identity, save: async () => {}, clear: async () => {} }}>
          <ProfileContext.Provider value={{ data: { me: { ...mama, email: 'x@y.z' }, members: [mama] }, failed: false }}>
            <MemoryRouter>
              <MyDay />
            </MemoryRouter>
          </ProfileContext.Provider>
        </IdentityContext.Provider>
      </Provider>,
    )
    const link = screen.getByRole('link', { name: 'Семейный календарь' })
    expect(link).toHaveAttribute('href', '/calendar')
    expect(link).toHaveTextContent('12')

    // приветствие и значок времени суток в одной строке; календарь стоит выше них
    const heading = screen.getByRole('heading', { level: 1 })
    expect(heading).toHaveTextContent('Добрый день, Лена!')
    const row = heading.parentElement!
    expect(within(row).getByText('☀️')).toBeInTheDocument()
    expect(link.compareDocumentPosition(heading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(row.contains(link)).toBe(false)
  })
})
