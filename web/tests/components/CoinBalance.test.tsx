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

function renderShell(who: typeof kid | typeof mama, coins: number | undefined, path = '/my-day') {
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
            <Route path="/my-day" element={<p>Мой день</p>} />
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

  it('баланс только на «Моём дне»: на профиле, в чатах и календаре его нет', async () => {
    for (const path of ['/profile', '/chat', '/chat/family', '/calendar']) {
      const { unmount } = renderShell(kid, 45, path)
      await screen.findByText(/Страница профиля|Список чатов|Переписка|Страница календаря/)
      expect(screen.queryByRole('link', { name: /Монеты/ })).not.toBeInTheDocument()
      unmount()
    }
  })

  it('значок профиля только на «Моём дне», в других разделах и на подстраницах его нет', async () => {
    const day = renderShell(mama, undefined, '/my-day')
    expect(await screen.findByRole('link', { name: /^Профиль/ })).toBeInTheDocument()
    day.unmount()
    for (const path of ['/tasks', '/chat', '/calendar', '/calendar/settings']) {
      const { unmount } = renderShell(mama, undefined, path)
      await screen.findByText(/Страница заданий|Список чатов|Страница календаря|Настройки календаря/)
      expect(screen.queryByRole('link', { name: /^Профиль/ })).not.toBeInTheDocument()
      unmount()
    }
  })

  it('панель табов только на главных разделах, на вложенных страницах и в переписке её нет', async () => {
    for (const path of ['/my-day', '/tasks', '/chat']) {
      const { unmount } = renderShell(mama, undefined, path)
      expect(await screen.findByRole('navigation', { name: 'Разделы' })).toBeInTheDocument()
      unmount()
    }
    for (const path of ['/calendar', '/calendar/settings', '/profile', '/chat/family']) {
      const { unmount } = renderShell(mama, undefined, path)
      await screen.findByText(/Страница календаря|Настройки календаря|Страница профиля|Переписка/)
      expect(screen.queryByRole('navigation', { name: 'Разделы' })).not.toBeInTheDocument()
      unmount()
    }
  })

  it('нулевой баланс у ребёнка тоже виден', async () => {
    renderShell(kid, 0)
    expect(await screen.findByRole('link', { name: /Монеты: 0/ })).toBeInTheDocument()
  })
})
