import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as api from '@/api'
import { IdentityContext } from '@/identity/context'
import type { Identity } from '@/identity/types'
import { START_PATH } from '@/lib/routes'
import FamilyCreated from '@/pages/FamilyCreated'

vi.mock('@/api', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/api')>()), getInvite: vi.fn() }))

const identity: Identity = { familyCode: 'c', memberId: 'm1', name: 'Лена', role: 'mama', token: 'tok' }
const invite = { code: 'ABC123', expiresAt: '2026-10-19T10:00:00.000Z' }

function renderPage(entry: { state?: unknown } = {}, who: Identity | null = identity) {
  render(
    <IdentityContext.Provider value={{ identity: who, save: async () => {}, clear: async () => {} }}>
      <MemoryRouter initialEntries={[{ pathname: '/created', state: entry.state }]}>
        <Routes>
          <Route path="/created" element={<FamilyCreated />} />
          <Route path="/family" element={<p>Страница семьи</p>} />
          <Route path={START_PATH} element={<p>Стартовая страница</p>} />
        </Routes>
      </MemoryRouter>
    </IdentityContext.Provider>,
  )
}

// фигурные скобки обязательны: иначе beforeEach вернёт мок и Vitest вызовет его как очистку после теста
beforeEach(() => {
  vi.mocked(api.getInvite).mockReset()
})

describe('«Семья создана»', () => {
  it('приглашение из состояния перехода показывается сразу, без запроса', () => {
    renderPage({ state: { invite } })
    expect(screen.getByRole('heading', { name: 'Семья создана!' })).toBeInTheDocument()
    expect(screen.getByText(/ABC123/)).toBeInTheDocument()
    expect(api.getInvite).not.toHaveBeenCalled()
  })

  it('после обновления страницы состояние потеряно: приглашение запрашивается заново', async () => {
    vi.mocked(api.getInvite).mockResolvedValue(invite as never)
    renderPage()
    expect(screen.getByText('Загрузка…')).toBeInTheDocument()
    expect(await screen.findByText(/ABC123/)).toBeInTheDocument()
    expect(api.getInvite).toHaveBeenCalledWith('tok')
  })

  it('не удалось получить приглашение: возвращает на страницу семьи', async () => {
    vi.mocked(api.getInvite).mockRejectedValue(new api.ApiError(404, 'not_found'))
    renderPage()
    expect(await screen.findByText('Страница семьи')).toBeInTheDocument()
  })

  it('без входа сразу уводит на страницу семьи', () => {
    renderPage({ state: { invite } }, null)
    expect(screen.getByText('Страница семьи')).toBeInTheDocument()
  })

  it('«ОК» открывает стартовую страницу', async () => {
    renderPage({ state: { invite } })
    fireEvent.click(screen.getByRole('button', { name: 'ОК' }))
    await waitFor(() => expect(screen.getByText('Стартовая страница')).toBeInTheDocument())
  })
})
