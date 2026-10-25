import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as api from '@/api'
import { ApiError, type LoginOption } from '@/api'
import { IdentityContext } from '@/identity/context'
import type { Identity } from '@/identity/types'
import { START_PATH } from '@/lib/routes'
import Login from '@/pages/Login'

vi.mock('@/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/api')>()),
  requestEmailCode: vi.fn(),
  login: vi.fn(),
}))

const session = { family: { code: 'FAM' }, member: { id: 'm1', name: 'Лена', role: 'mama', token: 'tok' } }
const options: LoginOption[] = [
  { id: 'm1', name: 'Лена', role: 'mama', familyCode: 'A', familyMembers: ['Лена', 'Миша'] },
  { id: 'm9', name: 'Лена', role: 'grandma', familyCode: 'B', familyMembers: ['Лена', 'Петя'] },
]

function renderLogin(identity: Identity | null = null) {
  const save = vi.fn().mockResolvedValue(undefined)
  render(
    <IdentityContext.Provider value={{ identity, save, clear: async () => {} }}>
      <MemoryRouter initialEntries={['/login']}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path={START_PATH} element={<p>Стартовая страница</p>} />
        </Routes>
      </MemoryRouter>
    </IdentityContext.Provider>,
  )
  return { save }
}

const typeEmail = (value: string) => fireEvent.change(screen.getByLabelText('Email'), { target: { value } })
const typeCode = (value: string) => fireEvent.change(screen.getByLabelText('Код из письма'), { target: { value } })
const click = (name: string | RegExp) => fireEvent.click(screen.getByRole('button', { name }))

async function toCodeStep() {
  typeEmail(' mama@example.com ')
  click('Получить код')
  await screen.findByLabelText('Код из письма')
}

// фигурные скобки обязательны: иначе beforeEach вернёт мок и Vitest вызовет его как очистку после теста
beforeEach(() => {
  vi.mocked(api.requestEmailCode).mockReset().mockResolvedValue(undefined)
  vi.mocked(api.login).mockReset()
})

describe('вход по email', () => {
  it('кнопка «Получить код» ждёт корректного email', () => {
    renderLogin()
    const button = screen.getByRole('button', { name: 'Получить код' })
    expect(button).toBeDisabled()
    typeEmail('не-почта')
    expect(button).toBeDisabled()
    typeEmail('mama@example.com')
    expect(button).toBeEnabled()
  })

  it('просит код на email без пробелов по краям и переходит к вводу кода', async () => {
    renderLogin()
    await toCodeStep()
    expect(api.requestEmailCode).toHaveBeenCalledWith('mama@example.com', 'login')
    expect(screen.getByText('mama@example.com')).toBeInTheDocument()
  })

  it('«слишком часто» не ошибка: форма кода всё равно открывается', async () => {
    vi.mocked(api.requestEmailCode).mockRejectedValue(new ApiError(429, 'too_soon'))
    renderLogin()
    await toCodeStep()
  })

  it('другая ошибка отправки кода остаётся на первом шаге', async () => {
    vi.mocked(api.requestEmailCode).mockRejectedValue(new ApiError(503, 'mail_busy'))
    renderLogin()
    typeEmail('mama@example.com')
    click('Получить код')
    expect(await screen.findByText(/перегружен/)).toBeInTheDocument()
    expect(screen.queryByLabelText('Код из письма')).not.toBeInTheDocument()
  })

  it('верный код сохраняет вход и открывает стартовую страницу', async () => {
    vi.mocked(api.login).mockResolvedValue(session as never)
    const { save } = renderLogin()
    await toCodeStep()
    typeCode('123456')
    click('Войти')
    expect(await screen.findByText('Стартовая страница')).toBeInTheDocument()
    expect(api.login).toHaveBeenCalledWith('mama@example.com', '123456', undefined)
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ memberId: 'm1', token: 'tok' }))
  })

  it('неверный код показывает понятное сообщение и остаётся на шаге кода', async () => {
    vi.mocked(api.login).mockRejectedValue(new ApiError(400, 'invalid_code'))
    renderLogin()
    await toCodeStep()
    typeCode('000000')
    click('Войти')
    expect(await screen.findByText('Неверный код или срок его действия истёк.')).toBeInTheDocument()
  })

  it('любой другой сбой входа: общее сообщение', async () => {
    vi.mocked(api.login).mockRejectedValue(new Error('boom'))
    renderLogin()
    await toCodeStep()
    typeCode('123456')
    click('Войти')
    expect(await screen.findByText('Не удалось войти. Попробуйте ещё раз.')).toBeInTheDocument()
  })

  it('email в нескольких семьях: предлагает выбрать и входит с тем же кодом и выбранным участником', async () => {
    vi.mocked(api.login).mockRejectedValueOnce(new ApiError(409, 'choose_member', { options })).mockResolvedValueOnce(session as never)
    renderLogin()
    await toCodeStep()
    typeCode('123456')
    click('Войти')
    expect(await screen.findByText(/есть в нескольких семьях/)).toBeInTheDocument()
    expect(screen.getByText('Семья: Лена, Петя')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Бабушка/ }))
    await waitFor(() => expect(screen.getByText('Стартовая страница')).toBeInTheDocument())
    expect(api.login).toHaveBeenLastCalledWith('mama@example.com', '123456', 'm9')
  })

  it('«Изменить email» возвращает к первому шагу', async () => {
    renderLogin()
    await toCodeStep()
    click('Изменить email')
    expect(screen.getByLabelText('Email')).toBeInTheDocument()
  })

  it('если на устройстве уже есть вход, сначала просит подтвердить замену', () => {
    renderLogin({ familyCode: 'c', memberId: 'm1', name: 'Лена', role: 'mama', token: 't' })
    expect(screen.queryByLabelText('Email')).not.toBeInTheDocument()
    expect(screen.getByText(/вы уже вошли/)).toBeInTheDocument()
    click('Всё равно продолжить')
    expect(screen.getByLabelText('Email')).toBeInTheDocument()
  })
})
