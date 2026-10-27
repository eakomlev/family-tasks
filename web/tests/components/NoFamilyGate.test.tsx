import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Provider } from 'react-redux'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as api from '@/api'
import { NoFamilyGate } from '@/components/NoFamilyGate'
import { IdentityContext } from '@/identity/context'
import { makeStore } from '@/store'

vi.mock('@/api', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/api')>()), createFamilyForMe: vi.fn(), joinFamilyAsMe: vi.fn() }))

const save = vi.fn(async () => {})
const clear = vi.fn(async () => {})

function setup() {
  const identity = { familyCode: 'old', memberId: 'old-id', name: 'Игорь', role: 'papa' as const, token: 'tok' }
  render(
    <Provider store={makeStore({ hydrate: false })}>
      <IdentityContext.Provider value={{ identity, save, clear }}>
        <NoFamilyGate />
      </IdentityContext.Provider>
    </Provider>,
  )
  return userEvent.setup()
}

beforeEach(() => {
  save.mockClear()
  clear.mockClear()
  vi.mocked(api.createFamilyForMe).mockReset().mockResolvedValue({ family: { code: 'new' }, member: { id: 'new-id', name: 'Игорь', role: 'mama', isOwner: true } })
  vi.mocked(api.joinFamilyAsMe).mockReset().mockResolvedValue({ family: { code: 'other' }, member: { id: 'new-id', name: 'Игорь', role: 'mama', isOwner: false } })
})
afterEach(cleanup)

describe('экран участника без семьи', () => {
  it('предлагает создать семью или присоединиться, присоединиться недоступно без ссылки', () => {
    setup()
    expect(screen.getByRole('heading', { name: 'Вы не состоите в семье' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Создать семью' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Присоединиться' })).toBeDisabled()
  })

  it('создание семьи запоминает новую запись на устройстве', async () => {
    const user = setup()
    await user.click(screen.getByRole('button', { name: 'Создать семью' }))
    await waitFor(() => expect(api.createFamilyForMe).toHaveBeenCalledWith('tok', 'mama'))
    await waitFor(() => expect(save).toHaveBeenCalledWith(expect.objectContaining({ familyCode: 'new', memberId: 'new-id', role: 'mama' })))
  })

  it('вступление берёт код из ссылки', async () => {
    const user = setup()
    await user.type(screen.getByLabelText('Ссылка-приглашение или код'), 'https://familytasks.ru/join?code=abc123')
    await user.click(screen.getByRole('button', { name: 'Присоединиться' }))
    await waitFor(() => expect(api.joinFamilyAsMe).toHaveBeenCalledWith('tok', 'abc123', 'mama'))
    await waitFor(() => expect(save).toHaveBeenCalledWith(expect.objectContaining({ familyCode: 'other' })))
  })

  it('понятно объясняет, что приглашение не найдено', async () => {
    vi.mocked(api.joinFamilyAsMe).mockRejectedValue(new api.ApiError(404, 'invite_not_found'))
    const user = setup()
    await user.type(screen.getByLabelText('Ссылка-приглашение или код'), 'zzz')
    await user.click(screen.getByRole('button', { name: 'Присоединиться' }))
    expect(await screen.findByText('Приглашение не найдено. Проверьте ссылку.')).toBeInTheDocument()
    expect(save).not.toHaveBeenCalled()
  })

  it('«Выйти» выходит на устройстве', async () => {
    const user = setup()
    await user.click(screen.getByRole('button', { name: 'Выйти' }))
    expect(clear).toHaveBeenCalled()
  })
})
