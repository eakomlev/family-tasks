import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Provider } from 'react-redux'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as api from '@/api'
import type { Member } from '@/api'
import { ConfirmProvider } from '@/components/ConfirmDialog'
import { IdentityContext } from '@/identity/context'
import Family from '@/pages/Family'
import FamilyEdit from '@/pages/FamilyEdit'
import { ProfileContext } from '@/profile/context'
import { makeStore } from '@/store'

vi.mock('@/api', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/api')>()), removeMember: vi.fn() }))

const mama: Member = { id: 'mama', name: 'Лена', role: 'mama', avatar: null, isOwner: true }
const papa: Member = { id: 'papa', name: 'Игорь', role: 'papa', avatar: null, isOwner: false }
const kid: Member = { id: 'kid', name: 'Миша', role: 'child', avatar: null, isOwner: false }
const members = [mama, papa, kid]

function Where() {
  return <p data-testid="where">{useLocation().pathname}</p>
}

function renderAt(path: string, me: Member) {
  const identity = { familyCode: 'c', memberId: me.id, name: me.name, role: me.role, token: 'tok' }
  return render(
    <Provider store={makeStore({ hydrate: false })}>
      <IdentityContext.Provider value={{ identity, save: async () => {}, clear: async () => {} }}>
        <ProfileContext.Provider value={{ data: { me: { ...me, email: 'x@y.z' }, members }, failed: false }}>
          <ConfirmProvider>
            <MemoryRouter initialEntries={[path]}>
              <Where />
              <Routes>
                <Route path="/family" element={<Family />} />
                <Route path="/family/edit" element={<FamilyEdit />} />
              </Routes>
            </MemoryRouter>
          </ConfirmProvider>
        </ProfileContext.Provider>
      </IdentityContext.Provider>
    </Provider>,
  )
}

beforeEach(() => {
  vi.mocked(api.removeMember).mockReset().mockResolvedValue(undefined)
})
afterEach(cleanup)

describe('ссылка «Изменить» на странице семьи', () => {
  it('есть у создателя и ведёт на редактирование, у остальных нет', () => {
    renderAt('/family', mama)
    expect(screen.getByRole('link', { name: 'Изменить' })).toHaveAttribute('href', '/family/edit')
    expect(screen.queryByRole('link', { name: 'Удалить семейный аккаунт' })).not.toBeInTheDocument()
    cleanup()
    renderAt('/family', papa)
    expect(screen.queryByRole('link', { name: 'Изменить' })).not.toBeInTheDocument()
  })
})

describe('страница «Изменить семью»', () => {
  it('не создателя возвращает на страницу семьи', () => {
    renderAt('/family/edit', papa)
    expect(screen.getByTestId('where')).toHaveTextContent('/family')
    expect(screen.queryByText('Изменить семью')).not.toBeInTheDocument()
  })

  it('взрослому «Убрать», ребёнку «Удалить», себя в списке нет, есть ссылка на удаление семьи', () => {
    renderAt('/family/edit', mama)
    expect(screen.getByRole('button', { name: 'Убрать' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Удалить' })).toBeInTheDocument()
    expect(screen.queryByText('Лена')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Удалить семейный аккаунт' })).toHaveAttribute('href', '/family/delete')
  })

  it('убирает взрослого после подтверждения и ничего не делает при отказе', async () => {
    const user = userEvent.setup()
    renderAt('/family/edit', mama)
    await user.click(screen.getByRole('button', { name: 'Убрать' }))
    const dialog = await screen.findByRole('alertdialog')
    await user.click(within(dialog).getByRole('button', { name: 'Отмена' }))
    expect(api.removeMember).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Убрать' }))
    const again = await screen.findByRole('alertdialog')
    await user.click(within(again).getByRole('button', { name: 'Убрать' }))
    await waitFor(() => expect(api.removeMember).toHaveBeenCalledWith('tok', 'papa'))
  })

  it('ошибку сервера показывает текстом', async () => {
    vi.mocked(api.removeMember).mockRejectedValue(new api.ApiError(404, 'member_not_found'))
    const user = userEvent.setup()
    renderAt('/family/edit', mama)
    await user.click(screen.getByRole('button', { name: 'Удалить' }))
    const dialog = await screen.findByRole('alertdialog')
    await user.click(within(dialog).getByRole('button', { name: 'Удалить' }))
    expect(await screen.findByText('Такого участника уже нет в семье.')).toBeInTheDocument()
  })
})
