import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as api from '@/api'
import { AppShell } from '@/components/AppShell'
import { CoinBalance } from '@/components/CoinBalance'
import { IdentityContext } from '@/identity/context'
import type { Identity } from '@/identity/types'

vi.mock('@/api', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/api')>()), getMe: vi.fn(), listChats: vi.fn() }))

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
  vi.mocked(api.getMe).mockResolvedValue({
    member: { ...who, email: 'x@y.z', ...(coins === undefined ? {} : { coins }) },
    family: { code: 'c' },
    members: [mama, kid],
  })
  vi.mocked(api.listChats).mockResolvedValue({ chats: [] })
  const identity: Identity = { familyCode: 'c', memberId: who.id, name: who.name, role: who.role, token: 'tok' }
  return render(
    <IdentityContext.Provider value={{ identity, save: async () => {}, clear: async () => {} }}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route element={<AppShell />}>
            <Route path="/tasks" element={<p>Страница заданий</p>} />
            <Route path="/profile" element={<p>Страница профиля</p>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </IdentityContext.Provider>,
  )
}

beforeEach(() => {
  vi.stubGlobal('WebSocket', QuietSocket)
})
afterEach(() => vi.unstubAllGlobals())

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

  it('нулевой баланс у ребёнка тоже виден', async () => {
    renderShell(kid, 0)
    expect(await screen.findByRole('link', { name: /Монеты: 0/ })).toBeInTheDocument()
  })
})
