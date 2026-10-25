import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as api from '@/api'
import type { Member } from '@/api'
import { ConfirmProvider } from '@/components/ConfirmDialog'
import { IdentityContext } from '@/identity/context'
import AccountDelete from '@/pages/AccountDelete'
import Profile from '@/pages/Profile'
import { ProfileContext } from '@/profile/context'

vi.mock('@/api', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/api')>()), deleteAccount: vi.fn(), logout: vi.fn() }))

const mama: Member = { id: 'mama', name: 'Лена', role: 'mama', avatar: null, isOwner: true }
const grandma: Member = { id: 'gm', name: 'Нина', role: 'grandma', avatar: null, isOwner: false }
const papa: Member = { id: 'papa', name: 'Игорь', role: 'papa', avatar: null, isOwner: false }
const kid: Member = { id: 'kid', name: 'Миша', role: 'child', avatar: null, isOwner: false }
const members = [mama, grandma, papa, kid]

const clear = vi.fn(async () => {})

function Where() {
  return <p data-testid="where">{useLocation().pathname}</p>
}

function renderAt(path: string, me: Member) {
  const identity = { familyCode: 'c', memberId: me.id, name: me.name, role: me.role, token: 'tok' }
  return render(
    <IdentityContext.Provider value={{ identity, save: async () => {}, clear }}>
      <ProfileContext.Provider value={{ data: { me: { ...me, email: 'x@y.z' }, members }, failed: false }}>
        <ConfirmProvider>
          <MemoryRouter initialEntries={[path]}>
            <Where />
            <Routes>
              <Route path="/profile" element={<Profile />} />
              <Route path="/profile/delete" element={<AccountDelete />} />
            </Routes>
          </MemoryRouter>
        </ConfirmProvider>
      </ProfileContext.Provider>
    </IdentityContext.Provider>,
  )
}

async function deleteWithConfirm(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Удалить аккаунт' }))
  const buttons = await screen.findAllByRole('button', { name: 'Удалить' })
  await user.click(buttons[buttons.length - 1])
}

// фигурные скобки обязательны: иначе beforeEach вернёт мок и Vitest вызовет его как очистку после теста
beforeEach(() => {
  clear.mockClear()
  vi.mocked(api.deleteAccount).mockReset().mockResolvedValue(undefined)
})
afterEach(cleanup)

describe('пункт «Удалить аккаунт» в профиле', () => {
  it('есть у родителя, бабушки, не создателя', () => {
    renderAt('/profile', papa)
    expect(screen.getByRole('link', { name: 'Удалить аккаунт' })).toHaveAttribute('href', '/profile/delete')
    cleanup()
    renderAt('/profile', grandma)
    expect(screen.getByRole('link', { name: 'Удалить аккаунт' })).toBeInTheDocument()
  })

  it('нет у создателя семьи и у ребёнка', () => {
    renderAt('/profile', mama)
    expect(screen.queryByRole('link', { name: 'Удалить аккаунт' })).not.toBeInTheDocument()
    cleanup()
    renderAt('/profile', kid)
    expect(screen.queryByRole('link', { name: 'Удалить аккаунт' })).not.toBeInTheDocument()
  })
})

describe('страница удаления аккаунта', () => {
  it('создателя и ребёнка возвращает в профиль', () => {
    renderAt('/profile/delete', mama)
    expect(screen.getByTestId('where')).toHaveTextContent('/profile')
    cleanup()
    renderAt('/profile/delete', kid)
    expect(screen.getByTestId('where')).toHaveTextContent('/profile')
  })

  it('объясняет, что будет удалено; «Отмена» в окне подтверждения ничего не удаляет', async () => {
    renderAt('/profile/delete', papa)
    expect(screen.getByText(/личные чаты целиком/)).toBeInTheDocument()
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Удалить аккаунт' }))
    await user.click(await screen.findByRole('button', { name: 'Отмена' }))
    expect(api.deleteAccount).not.toHaveBeenCalled()
  })

  it('после подтверждения удаляет, показывает прощание, а «До встречи!» выходит на устройстве', async () => {
    renderAt('/profile/delete', papa)
    const user = userEvent.setup()
    await deleteWithConfirm(user)
    expect(await screen.findByRole('heading', { name: 'Аккаунт удалён' })).toBeInTheDocument()
    expect(api.deleteAccount).toHaveBeenCalledWith('tok')
    expect(clear).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'До встречи!' }))
    await waitFor(() => expect(clear).toHaveBeenCalledTimes(1))
  })

  it('ошибка сервера: сообщение остаётся на странице, повторить можно', async () => {
    vi.mocked(api.deleteAccount).mockRejectedValue(new api.ApiError(403, 'owner_cannot_delete'))
    renderAt('/profile/delete', papa)
    await deleteWithConfirm(userEvent.setup())
    expect(await screen.findByText(/Создатель семьи не может удалить только свой аккаунт/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Удалить аккаунт' })).toBeEnabled()
  })

  it('двойное нажатие подтверждения удаляет один раз', async () => {
    renderAt('/profile/delete', papa)
    await deleteWithConfirm(userEvent.setup())
    await screen.findByRole('heading', { name: 'Аккаунт удалён' })
    expect(api.deleteAccount).toHaveBeenCalledTimes(1)
  })
})
