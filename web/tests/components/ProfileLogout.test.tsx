import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as api from '@/api'
import type { Member } from '@/api'
import { ConfirmProvider } from '@/components/ConfirmDialog'
import { IdentityContext } from '@/identity/context'
import Profile from '@/pages/Profile'
import { ProfileContext } from '@/profile/context'

vi.mock('@/api', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/api')>()), logout: vi.fn() }))

const me: Member = { id: 'me', name: 'Лена', role: 'mama', avatar: null, isOwner: true }

function renderProfile(as: Member & { coins?: number; birthDate?: string | null } = me) {
  const clear = vi.fn().mockResolvedValue(undefined)
  const identity = { familyCode: 'c', memberId: 'me', name: 'Лена', role: as.role, token: 'tok' }
  render(
    <IdentityContext.Provider value={{ identity, save: async () => {}, clear }}>
      <ProfileContext.Provider value={{ data: { me: { ...as, email: 'l@x.y' }, members: [me] }, failed: false }}>
        <ConfirmProvider>
          <MemoryRouter><Profile /></MemoryRouter>
        </ConfirmProvider>
      </ProfileContext.Provider>
    </IdentityContext.Provider>,
  )
  return { clear }
}

// фигурные скобки обязательны: иначе beforeEach вернёт мок и Vitest вызовет его как очистку после теста
beforeEach(() => {
  vi.mocked(api.logout).mockReset().mockResolvedValue(undefined)
})

describe('«Выйти» на странице профиля', () => {
  it('кнопка последняя на странице, после пунктов меню', () => {
    renderProfile()
    const logout = screen.getByRole('button', { name: 'Выйти' })
    const theme = screen.getByRole('link', { name: /Тема/ })
    expect(theme.compareDocumentPosition(logout) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    const all = [...document.querySelectorAll('button, input, textarea, a')]
    expect(all[all.length - 1]).toBe(logout)
  })

  it('выход требует подтверждения: «Отмена» ничего не делает', async () => {
    const { clear } = renderProfile()
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Выйти' }))
    expect(screen.getByRole('alertdialog', { name: 'Выйти из аккаунта?' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Отмена' }))
    expect(api.logout).not.toHaveBeenCalled()
    expect(clear).not.toHaveBeenCalled()
  })

  it('подтверждение: сессия отзывается на сервере, вход на устройстве очищается', async () => {
    const { clear } = renderProfile()
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Выйти' }))
    await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Выйти' }))
    await waitFor(() => expect(clear).toHaveBeenCalledTimes(1))
    expect(api.logout).toHaveBeenCalledWith('tok')
    expect(api.logout).toHaveBeenCalledTimes(1)
  })

  it('если сервер недоступен, на устройстве всё равно выходим', async () => {
    vi.mocked(api.logout).mockRejectedValue(new api.ApiError(0, 'network'))
    const { clear } = renderProfile()
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Выйти' }))
    await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Выйти' }))
    await waitFor(() => expect(clear).toHaveBeenCalledTimes(1))
  })
})

describe('профиль кратко', () => {
  it('имя, роль, email и «Изменить» справа сверху; полей ввода нет', () => {
    renderProfile()
    expect(screen.getByRole('heading', { name: 'Лена' })).toBeInTheDocument()
    expect(screen.getByText('Мама')).toBeInTheDocument()
    expect(screen.getByText('l@x.y')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Изменить' })).toHaveAttribute('href', '/profile/edit')
    expect(document.querySelectorAll('input, textarea')).toHaveLength(0)
  })

  it('у родителя пункты «Уведомления» и «Тема», расписаний нет', () => {
    renderProfile()
    expect(screen.getByRole('link', { name: /Уведомления/ })).toHaveAttribute('href', '/profile/notifications')
    expect(screen.getByRole('link', { name: /Тема/ })).toHaveAttribute('href', '/profile/theme')
    expect(screen.queryByRole('link', { name: /Расписание/ })).not.toBeInTheDocument()
  })

  it('у ребёнка добавлены расписания уроков и тренировок, монеты и дата рождения с возрастом', () => {
    renderProfile({ id: 'kid', name: 'Миша', role: 'child', avatar: null, isOwner: false, coins: 40, birthDate: '2016-01-01' })
    expect(screen.getByRole('link', { name: /Расписание уроков/ })).toHaveAttribute('href', '/profile/schedule')
    expect(screen.getByRole('link', { name: /Расписание тренировок/ })).toHaveAttribute('href', '/profile/trainings')
    expect(screen.getByRole('link', { name: /Монеты|40/ })).toHaveAttribute('href', '/coins')
    expect(screen.getByText(/1 января 2016/)).toBeInTheDocument()
  })
})
