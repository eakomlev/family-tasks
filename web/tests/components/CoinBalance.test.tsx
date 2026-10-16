import { render, screen } from '@testing-library/react'
import { Provider } from 'react-redux'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as api from '@/api'
import { AppShell } from '@/components/AppShell'
import { CoinBalance } from '@/components/CoinBalance'
import { IdentityContext } from '@/identity/context'
import type { Identity } from '@/identity/types'
import { makeStore } from '@/store'
import { setSession } from '@/store/session'

vi.mock('@/api', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/api')>()), listChats: vi.fn() }))

describe('CoinBalance', () => {
  it('показывает число и подпись для скринридера; ведёт на историю', () => {
    render(<MemoryRouter><CoinBalance coins={120} /></MemoryRouter>)
    const link = screen.getByRole('link', { name: /Монеты: 120/ })
    expect(link).toHaveTextContent('120')
    expect(link).toHaveAttribute('href', '/coins')
  })

  it('ноль и отрицательный баланс показываются как есть', () => {
    const { rerender } = render(<MemoryRouter><CoinBalance coins={0} /></MemoryRouter>)
    expect(screen.getByRole('link')).toHaveTextContent('0')
    rerender(<MemoryRouter><CoinBalance coins={-15} /></MemoryRouter>)
    expect(screen.getByRole('link')).toHaveTextContent('-15')
  })
})

// WebSocket в оболочке нам не нужен: подставляем пустой
class QuietSocket {
  onopen?: () => void
  onmessage?: () => void
  onclose?: () => void
  send() {}
  close() {}
}

const kid = { id: 'kid', name: 'Миша', role: 'child' as const, avatar: null, isOwner: false }
const mama = { id: 'mama', name: 'Лена', role: 'mama' as const, avatar: null, isOwner: true }

function renderShell(who: typeof kid | typeof mama, coins: number | undefined, path = '/tasks') {
  const overview = {
    member: { ...who, email: 'x@y.z', ...(coins === undefined ? {} : { coins }) },
    family: { code: 'c' },
    members: [mama, kid],
  }
  // профиль идёт через RTK Query (настоящий fetch), остальные запросы оболочки отвечают ошибкой
  vi.stubGlobal('fetch', async (input: string) =>
    String(input) === '/api/me' ? new Response(JSON.stringify(overview), { status: 200 }) : new Response('{}', { status: 500 }),
  )
  setSession({ token: 'tok', memberId: who.id })
  vi.mocked(api.listChats).mockResolvedValue({ chats: [] })
  const identity: Identity = { familyCode: 'c', memberId: who.id, name: who.name, role: who.role, token: 'tok' }
  return render(
    <Provider store={makeStore({ hydrate: false })}>
    <IdentityContext.Provider value={{ identity, save: async () => {}, clear: async () => {} }}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route element={<AppShell />}>
            <Route path="/tasks" element={<p>Страница заданий</p>} />
            <Route path="/profile" element={<p>Страница профиля</p>} />
            <Route path="/calendar" element={<p>Страница календаря</p>} />
            <Route path="/calendar/settings" element={<p>Настройки календаря</p>} />
            <Route path="/chat" element={<p>Список чатов</p>} />
            <Route path="/chat/:chat" element={<p>Переписка</p>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </IdentityContext.Provider>
    </Provider>,
  )
}

beforeEach(() => {
  vi.stubGlobal('WebSocket', QuietSocket)
})
afterEach(() => {
  vi.unstubAllGlobals()
  setSession(undefined)
})

describe('баланс монет сверху', () => {
  it('у ребёнка стоит слева от значка профиля', async () => {
    renderShell(kid, 120)
    const chip = await screen.findByRole('link', { name: /Монеты: 120/ })
    const profile = screen.getByRole('link', { name: /^Профиль/ })
    // в документе баланс идёт раньше значка профиля, то есть слева от него
    expect(chip.compareDocumentPosition(profile) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('у родителя баланса нет', async () => {
    renderShell(mama, undefined)
    await screen.findByRole('link', { name: /^Профиль/ })
    expect(screen.queryByRole('link', { name: /Монеты/ })).not.toBeInTheDocument()
  })

  it('на странице профиля значка профиля нет, а баланс остаётся', async () => {
    renderShell(kid, 45, '/profile')
    expect(await screen.findByRole('link', { name: /Монеты: 45/ })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /^Профиль/ })).not.toBeInTheDocument()
  })

  it('в переписке баланс скрыт, в списке чатов остаётся', async () => {
    const { unmount } = renderShell(kid, 120, '/chat/family')
    await screen.findByText('Переписка')
    expect(screen.queryByRole('link', { name: /Монеты/ })).not.toBeInTheDocument()
    unmount()
    renderShell(kid, 120, '/chat')
    expect(await screen.findByRole('link', { name: /Монеты: 120/ })).toBeInTheDocument()
  })

  it('на странице календаря значка профиля нет (у ребёнка баланс остаётся), на его подстраницах значок есть', async () => {
    const { unmount } = renderShell(mama, undefined, '/calendar')
    await screen.findByText('Страница календаря')
    expect(screen.queryByRole('link', { name: /^Профиль/ })).not.toBeInTheDocument()
    unmount()
    const child = renderShell(kid, 45, '/calendar')
    expect(await screen.findByRole('link', { name: /Монеты: 45/ })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /^Профиль/ })).not.toBeInTheDocument()
    child.unmount()
    renderShell(mama, undefined, '/calendar/settings')
    expect(await screen.findByRole('link', { name: /^Профиль/ })).toBeInTheDocument()
  })

  it('нулевой баланс у ребёнка тоже виден', async () => {
    renderShell(kid, 0)
    expect(await screen.findByRole('link', { name: /Монеты: 0/ })).toBeInTheDocument()
  })
})
