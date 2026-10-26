import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { Provider } from 'react-redux'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as api from '@/api'
import { ApiError, type Member } from '@/api'
import { ConfirmProvider } from '@/components/ConfirmDialog'
import { RoleForm } from '@/components/RoleForm'
import { IdentityContext } from '@/identity/context'
import { contactBody, formatPhone, isValidContact, normalizePhone, trimContact } from '@/lib/contact'
import { describeCodeError, describeResendError } from '@/lib/errors'
import { START_PATH } from '@/lib/routes'
import { CREATOR_ROLES } from '@/lib/roles'
import Login from '@/pages/Login'
import Profile from '@/pages/Profile'
import ProfilePhone from '@/pages/ProfilePhone'
import { ProfileContext } from '@/profile/context'
import { makeStore } from '@/store'

vi.mock('@/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/api')>()),
  requestCode: vi.fn(),
  login: vi.fn(),
  requestPhoneCode: vi.fn(),
  savePhone: vi.fn(),
  removePhone: vi.fn(),
  logout: vi.fn(),
}))

const click = (name: string | RegExp) => fireEvent.click(screen.getByRole('button', { name }))
const PHONE = '+7 911 222-33-44'

beforeEach(() => {
  vi.mocked(api.requestCode).mockReset().mockResolvedValue(undefined)
  vi.mocked(api.login).mockReset()
  vi.mocked(api.requestPhoneCode).mockReset().mockResolvedValue(undefined)
  vi.mocked(api.savePhone).mockReset()
  vi.mocked(api.removePhone).mockReset().mockResolvedValue(undefined)
})

describe('контакт: телефон или email', () => {
  it('нормализует российские мобильные номера и отвергает прочие', () => {
    expect(normalizePhone('8 (911) 222-33-44')).toBe('+79112223344')
    expect(normalizePhone('+7 911 222 33 44')).toBe('+79112223344')
    expect(normalizePhone('79112223344')).toBe('+79112223344')
    expect(normalizePhone('+74951234567')).toBeNull()
    expect(normalizePhone('+380501234567')).toBeNull()
    expect(normalizePhone('911222')).toBeNull()
  })

  it('показывает номер читаемо, а в запрос кладёт нормализованный', () => {
    expect(formatPhone('89112223344')).toBe('+7 911 222-33-44')
    expect(contactBody({ kind: 'phone', value: '8 911 222-33-44' })).toEqual({ phone: '+79112223344' })
    expect(contactBody({ kind: 'email', value: ' a@b.co ' })).toEqual({ email: 'a@b.co' })
    expect(trimContact({ kind: 'phone', value: ' 8911 ' })).toEqual({ kind: 'phone', value: '8911' })
  })

  it('isValidContact проверяет по виду контакта', () => {
    expect(isValidContact({ kind: 'phone', value: PHONE })).toBe(true)
    expect(isValidContact({ kind: 'phone', value: 'a@b.co' })).toBe(false)
    expect(isValidContact({ kind: 'email', value: PHONE })).toBe(false)
  })

  it('тексты ошибок для SMS', () => {
    expect(describeCodeError(new ApiError(503, 'sms_busy'))).toMatch(/SMS.*перегружен/)
    expect(describeCodeError(new ApiError(400, 'invalid_phone'))).toMatch(/российский мобильный номер/)
    expect(describeResendError(new ApiError(503, 'sms_busy'))).toMatch(/SMS.*перегружен/)
  })
})

describe('вход по телефону', () => {
  const session = { family: { code: 'FAM' }, member: { id: 'm1', name: 'Лена', role: 'mama', token: 'tok' } }

  function renderLogin() {
    const save = vi.fn().mockResolvedValue(undefined)
    render(
      <IdentityContext.Provider value={{ identity: null, save, clear: async () => {} }}>
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

  const toPhone = () => fireEvent.click(screen.getByRole('tab', { name: 'Телефон' }))
  const typePhone = (value: string) => fireEvent.change(screen.getByLabelText('Номер телефона'), { target: { value } })

  it('переключатель «Телефон» заменяет поле email; кнопка ждёт корректного номера', () => {
    renderLogin()
    expect(screen.getByLabelText('Email')).toBeInTheDocument()
    toPhone()
    expect(screen.queryByLabelText('Email')).not.toBeInTheDocument()
    const button = screen.getByRole('button', { name: 'Получить код' })
    expect(button).toBeDisabled()
    typePhone('123')
    expect(button).toBeDisabled()
    typePhone(PHONE)
    expect(button).toBeEnabled()
  })

  it('код просится на телефон, шаг кода говорит про SMS, вход идёт с тем же контактом', async () => {
    vi.mocked(api.login).mockResolvedValue(session as never)
    const { save } = renderLogin()
    toPhone()
    typePhone(` ${PHONE} `)
    click('Получить код')
    expect(await screen.findByLabelText('Код из SMS')).toBeInTheDocument()
    expect(api.requestCode).toHaveBeenCalledWith({ kind: 'phone', value: PHONE }, 'login')
    expect(screen.getByText(/Мы отправили SMS с кодом на номер/)).toBeInTheDocument()
    expect(screen.getByText(PHONE)).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Код из SMS'), { target: { value: '123456' } })
    click('Войти')
    expect(await screen.findByText('Стартовая страница')).toBeInTheDocument()
    expect(api.login).toHaveBeenCalledWith({ kind: 'phone', value: PHONE }, '123456', undefined)
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ memberId: 'm1', token: 'tok' }))
  })

  it('SMS перегружены: понятный текст и остаёмся на первом шаге', async () => {
    vi.mocked(api.requestCode).mockRejectedValue(new ApiError(503, 'sms_busy'))
    renderLogin()
    toPhone()
    typePhone(PHONE)
    click('Получить код')
    expect(await screen.findByText(/SMS сейчас перегружен/)).toBeInTheDocument()
    expect(screen.queryByLabelText('Код из SMS')).not.toBeInTheDocument()
  })

  it('«Изменить номер» возвращает к первому шагу', async () => {
    renderLogin()
    toPhone()
    typePhone(PHONE)
    click('Получить код')
    await screen.findByLabelText('Код из SMS')
    click('Изменить номер')
    expect(screen.getByLabelText('Номер телефона')).toBeInTheDocument()
  })
})

describe('регистрация по телефону', () => {
  it('в данные регистрации уходит phone без email', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    render(<RoleForm roles={CREATOR_ROLES} submitLabel="Создать семью" onSubmit={onSubmit} />)
    fireEvent.click(screen.getByLabelText('Мама'))
    fireEvent.change(screen.getByLabelText('Ваше имя'), { target: { value: ' Лена ' } })
    fireEvent.click(screen.getByRole('tab', { name: 'Телефон' }))
    fireEvent.change(screen.getByLabelText(/^Номер телефона/), { target: { value: PHONE } })
    fireEvent.click(screen.getByRole('checkbox'))
    click('Получить код')
    const code = await screen.findByLabelText('Код из SMS')
    expect(api.requestCode).toHaveBeenCalledWith({ kind: 'phone', value: PHONE }, 'signup')
    fireEvent.change(code, { target: { value: '654321' } })
    click('Создать семью')
    await waitFor(() => expect(onSubmit).toHaveBeenCalled())
    expect(onSubmit).toHaveBeenCalledWith({ role: 'mama', name: 'Лена', phone: '+79112223344', consent: true, code: '654321' })
  })

  it('номер, который уже есть в семье, возвращает к данным с понятным текстом', async () => {
    const onSubmit = vi.fn().mockRejectedValue(new ApiError(409, 'phone_taken'))
    render(<RoleForm roles={CREATOR_ROLES} submitLabel="Создать семью" onSubmit={onSubmit} />)
    fireEvent.click(screen.getByLabelText('Мама'))
    fireEvent.change(screen.getByLabelText('Ваше имя'), { target: { value: 'Лена' } })
    fireEvent.click(screen.getByRole('tab', { name: 'Телефон' }))
    fireEvent.change(screen.getByLabelText(/^Номер телефона/), { target: { value: PHONE } })
    fireEvent.click(screen.getByRole('checkbox'))
    click('Получить код')
    fireEvent.change(await screen.findByLabelText('Код из SMS'), { target: { value: '654321' } })
    click('Создать семью')
    expect(await screen.findByText(/номер уже используется в семье/)).toBeInTheDocument()
    expect(screen.getByLabelText(/^Номер телефона/)).toBeInTheDocument()
  })
})

describe('телефон в профиле', () => {
  const base: Member = { id: 'me', name: 'Лена', role: 'mama', avatar: null, isOwner: true }
  const identity = { familyCode: 'c', memberId: 'me', name: 'Лена', role: 'mama' as const, token: 'tok' }

  function renderPage(page: React.ReactNode, me: Partial<{ email: string | null; phone: string | null }>) {
    render(
      <Provider store={makeStore({ hydrate: false })}>
        <IdentityContext.Provider value={{ identity, save: async () => {}, clear: async () => {} }}>
          <ProfileContext.Provider value={{ data: { me: { ...base, email: 'l@x.y', phone: null, ...me }, members: [base] }, failed: false }}>
            <ConfirmProvider>
              <MemoryRouter>{page}</MemoryRouter>
            </ConfirmProvider>
          </ProfileContext.Provider>
        </IdentityContext.Provider>
      </Provider>,
    )
  }

  it('профиль показывает номер и ведёт на страницу номера', () => {
    renderPage(<Profile />, { phone: '+79112223344' })
    expect(screen.getByText(PHONE)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Телефон для входа' })).toHaveAttribute('href', '/profile/phone')
  })

  it('без номера: пункт «Добавить телефон для входа»; у участника без email показан только номер', () => {
    renderPage(<Profile />, { email: null })
    expect(screen.getByRole('link', { name: 'Добавить телефон для входа' })).toBeInTheDocument()
    renderPage(<Profile />, { email: null, phone: '+79112223344' })
    expect(screen.getAllByText(PHONE).length).toBeGreaterThan(0)
  })

  it('добавление: код на новый номер, подтверждение, сообщение «Готово»', async () => {
    vi.mocked(api.savePhone).mockResolvedValue({ phone: '+79112223344' })
    renderPage(<ProfilePhone />, {})
    fireEvent.change(screen.getByLabelText('Номер телефона'), { target: { value: PHONE } })
    click('Получить код')
    const code = await screen.findByLabelText('Код из SMS')
    expect(api.requestPhoneCode).toHaveBeenCalledWith('tok', PHONE)
    fireEvent.change(code, { target: { value: '123456' } })
    click('Подтвердить')
    expect(await screen.findByText(/войти можно по номеру/)).toBeInTheDocument()
    expect(api.savePhone).toHaveBeenCalledWith('tok', PHONE, '123456')
  })

  it('неверный код и занятый номер: понятные сообщения', async () => {
    vi.mocked(api.requestPhoneCode).mockRejectedValueOnce(new ApiError(409, 'phone_taken'))
    renderPage(<ProfilePhone />, {})
    fireEvent.change(screen.getByLabelText('Номер телефона'), { target: { value: PHONE } })
    click('Получить код')
    expect(await screen.findByText(/уже есть у другого участника/)).toBeInTheDocument()

    vi.mocked(api.savePhone).mockRejectedValueOnce(new ApiError(400, 'invalid_code'))
    click('Получить код')
    fireEvent.change(await screen.findByLabelText('Код из SMS'), { target: { value: '000000' } })
    click('Подтвердить')
    expect(await screen.findByText('Неверный код или срок его действия истёк.')).toBeInTheDocument()
  })

  it('убрать номер можно только при наличии email и после подтверждения', async () => {
    renderPage(<ProfilePhone />, { phone: '+79112223344' })
    click('Убрать номер')
    fireEvent.click(await screen.findByRole('button', { name: 'Убрать' }))
    await waitFor(() => expect(api.removePhone).toHaveBeenCalledWith('tok'))
  })

  it('без email кнопки «Убрать номер» нет: это единственный способ входа', () => {
    renderPage(<ProfilePhone />, { email: null, phone: '+79112223344' })
    expect(screen.queryByRole('button', { name: 'Убрать номер' })).not.toBeInTheDocument()
  })
})
