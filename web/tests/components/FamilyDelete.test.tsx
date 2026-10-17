import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as api from '@/api'
import type { Member } from '@/api'
import { ConfirmProvider } from '@/components/ConfirmDialog'
import { IdentityContext } from '@/identity/context'
import Family from '@/pages/Family'
import FamilyDelete from '@/pages/FamilyDelete'
import { ProfileContext } from '@/profile/context'

vi.mock('@/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/api')>()),
  requestFamilyDeletion: vi.fn(),
  logout: vi.fn(),
}))

const mama: Member = { id: 'mama', name: 'Лена', role: 'mama', avatar: null, isOwner: true }
const papa: Member = { id: 'papa', name: 'Игорь', role: 'papa', avatar: null, isOwner: false }
const kid: Member = { id: 'kid', name: 'Миша', role: 'child', avatar: null, isOwner: false }
const members = [mama, papa, kid]

const clear = vi.fn(async () => {})

function Where() {
  return <p data-testid="where">{useLocation().pathname}</p>
}

function renderAt(path: string, me: Member = mama) {
  const identity = { familyCode: 'c', memberId: me.id, name: me.name, role: me.role, token: 'tok' }
  return render(
    <IdentityContext.Provider value={{ identity, save: async () => {}, clear }}>
      <ProfileContext.Provider value={{ data: { me: { ...me, email: 'x@y.z' }, members }, failed: false }}>
        <ConfirmProvider>
          <MemoryRouter initialEntries={[path]}>
            <Where />
            <Routes>
              <Route path="/family" element={<Family />} />
              <Route path="/family/delete" element={<FamilyDelete />} />
            </Routes>
          </MemoryRouter>
        </ConfirmProvider>
      </ProfileContext.Provider>
    </IdentityContext.Provider>,
  )
}

// «Удалить» на странице и подтверждение в окне (там тоже кнопка «Удалить», она последняя)
async function deleteWithConfirm(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Удалить' }))
  const buttons = await screen.findAllByRole('button', { name: 'Удалить' })
  await user.click(buttons[buttons.length - 1])
}

beforeEach(() => {
  clear.mockClear()
  vi.mocked(api.requestFamilyDeletion).mockReset().mockResolvedValue({ requestedAt: '2026-10-17T10:00:00Z' })
  vi.mocked(api.logout).mockReset().mockResolvedValue(undefined)
})
afterEach(cleanup)

describe('ссылка на странице семьи', () => {
  it('создатель видит «Удалить семейный аккаунт» в самом низу страницы и переходит по ней', async () => {
    renderAt('/family')
    const link = screen.getByRole('link', { name: 'Удалить семейный аккаунт' })
    expect(link).toHaveAttribute('href', '/family/delete')
    // ссылка последняя на странице, после списка участников
    expect(document.querySelector('main')!.lastElementChild).toBe(link)
    await userEvent.click(link)
    expect(screen.getByRole('heading', { name: 'Удаление семейного аккаунта' })).toBeInTheDocument()
  })

  it('остальным участникам ссылки нет', () => {
    renderAt('/family', papa)
    expect(screen.queryByRole('link', { name: 'Удалить семейный аккаунт' })).not.toBeInTheDocument()
  })
})

describe('страница удаления семьи', () => {
  it('описывает, что будет удалено: аккаунты, чаты, файлы; красная кнопка «Удалить» внизу', () => {
    renderAt('/family/delete')
    const text = document.body.textContent ?? ''
    expect(text).toMatch(/все аккаунты участников семьи \(3\)/)
    expect(text).toMatch(/все чаты и сообщения/)
    expect(text).toMatch(/все фото и файлы/)
    expect(text).toMatch(/без возможности восстановления/)
    const button = screen.getByRole('button', { name: 'Удалить' })
    // кнопка идёт после описания, в самом низу
    expect(document.querySelector('main')!.lastElementChild!.contains(button)).toBe(true)
  })

  it('не создатель уходит на страницу семьи', async () => {
    renderAt('/family/delete', papa)
    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent(/^\/family$/))
  })

  it('без подтверждения заявка не уходит', async () => {
    const user = userEvent.setup()
    renderAt('/family/delete')
    await user.click(screen.getByRole('button', { name: 'Удалить' }))
    expect(await screen.findByText(/Все данные семьи будут удалены безвозвратно/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Отмена' }))
    expect(api.requestFamilyDeletion).not.toHaveBeenCalled()
    expect(screen.queryByText(/Надеемся/)).not.toBeInTheDocument()
  })

  it('подтверждение: заявка уходит, показано прощание; «До встречи!» выходит из аккаунта', async () => {
    const user = userEvent.setup()
    renderAt('/family/delete')
    await deleteWithConfirm(user)
    await waitFor(() => expect(api.requestFamilyDeletion).toHaveBeenCalledWith('tok'))

    expect(await screen.findByText(/Данные вашей семьи будут удалены/)).toBeInTheDocument()
    expect(screen.getByText('Надеемся, мы ещё увидимся!')).toBeInTheDocument()
    // описание и красная кнопка пропали, выхода пока не было
    expect(screen.queryByText(/без возможности восстановления/)).not.toBeInTheDocument()
    expect(clear).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'До встречи!' }))
    await waitFor(() => expect(clear).toHaveBeenCalledTimes(1))
    expect(api.logout).toHaveBeenCalledWith('tok')
  })

  it('выход проходит, даже если сервер недоступен', async () => {
    vi.mocked(api.logout).mockRejectedValue(new api.ApiError(0, 'network'))
    const user = userEvent.setup()
    renderAt('/family/delete')
    await deleteWithConfirm(user)
    await user.click(await screen.findByRole('button', { name: 'До встречи!' }))
    await waitFor(() => expect(clear).toHaveBeenCalledTimes(1))
  })

  it('ошибка: причина показана, остаёмся на странице, можно повторить', async () => {
    vi.mocked(api.requestFamilyDeletion).mockRejectedValueOnce(new api.ApiError(0, 'network')).mockResolvedValue({ requestedAt: 'x' })
    const user = userEvent.setup()
    renderAt('/family/delete')
    await deleteWithConfirm(user)
    expect(await screen.findByText('Нет связи с сервером. Попробуйте ещё раз.')).toBeInTheDocument()
    expect(screen.queryByText(/Надеемся/)).not.toBeInTheDocument()
    await deleteWithConfirm(user)
    expect(await screen.findByText('Надеемся, мы ещё увидимся!')).toBeInTheDocument()
    expect(api.requestFamilyDeletion).toHaveBeenCalledTimes(2)
  })
})
