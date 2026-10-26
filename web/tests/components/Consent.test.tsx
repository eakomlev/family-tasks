import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { Provider } from 'react-redux'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as api from '@/api'
import { ApiError, type Member } from '@/api'
import { AppShell } from '@/components/AppShell'
import { ConfirmProvider } from '@/components/ConfirmDialog'
import { ConsentGate } from '@/components/ConsentGate'
import { RoleForm } from '@/components/RoleForm'
import { describeSignupError } from '@/components/RoleForm/utils'
import { IdentityContext } from '@/identity/context'
import { OPERATOR } from '@/lib/legal'
import { CREATOR_ROLES } from '@/lib/roles'
import Privacy from '@/pages/Privacy'
import Profile from '@/pages/Profile'
import Terms from '@/pages/Terms'
import { ProfileContext } from '@/profile/context'
import { makeStore } from '@/store'
import { setSession } from '@/store/session'

vi.mock('@/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/api')>()),
  requestCode: vi.fn(),
  acceptConsent: vi.fn(),
  listChats: vi.fn(),
}))

const click = (name: string | RegExp) => fireEvent.click(screen.getByRole('button', { name }))
const identity = { familyCode: 'c', memberId: 'me', name: 'Лена', role: 'mama' as const, token: 'tok' }
const base: Member = { id: 'me', name: 'Лена', role: 'mama', avatar: null, isOwner: true }

afterEach(() => vi.unstubAllGlobals())
beforeEach(() => {
  vi.mocked(api.requestCode).mockReset().mockResolvedValue(undefined)
  vi.mocked(api.acceptConsent).mockReset().mockResolvedValue(undefined)
})

describe('галочка согласия при регистрации', () => {
  const fill = () => {
    fireEvent.click(screen.getByLabelText('Мама'))
    fireEvent.change(screen.getByLabelText('Ваше имя'), { target: { value: 'Лена' } })
    fireEvent.change(screen.getByLabelText(/^Email/), { target: { value: 'mama@example.com' } })
  }

  it('по умолчанию выключена, без неё «Получить код» недоступна', () => {
    render(<RoleForm roles={CREATOR_ROLES} submitLabel="Создать семью" onSubmit={async () => {}} />)
    fill()
    const box = screen.getByRole('checkbox')
    expect(box).not.toBeChecked()
    expect(screen.getByRole('button', { name: 'Получить код' })).toBeDisabled()
    fireEvent.click(box)
    expect(screen.getByRole('button', { name: 'Получить код' })).toBeEnabled()
    fireEvent.click(box)
    expect(screen.getByRole('button', { name: 'Получить код' })).toBeDisabled()
  })

  it('текст называет оператора и ведёт на политику; соглашение отдельной ссылкой, не в галочке', () => {
    render(<RoleForm roles={CREATOR_ROLES} submitLabel="Создать семью" onSubmit={async () => {}} />)
    const label = screen.getByRole('checkbox').closest('label')!
    expect(label).toHaveTextContent(`оператору (${OPERATOR.name})`)
    expect(label).toHaveTextContent('несовершеннолетних детей')
    expect(within(label).getByRole('link', { name: 'Политики обработки персональных данных' })).toHaveAttribute('href', '/privacy#consent')
    // соглашение принимается отдельной строкой, а не внутри согласия
    expect(label).not.toHaveTextContent('Пользовательское соглашение')
    expect(screen.getByRole('link', { name: 'Пользовательское соглашение' })).toHaveAttribute('href', '/terms')
  })

  it('в данные регистрации уходит consent: true', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    render(<RoleForm roles={CREATOR_ROLES} submitLabel="Создать семью" onSubmit={onSubmit} />)
    fill()
    fireEvent.click(screen.getByRole('checkbox'))
    click('Получить код')
    fireEvent.change(await screen.findByLabelText('Код из письма'), { target: { value: '123456' } })
    click('Создать семью')
    await waitFor(() => expect(onSubmit).toHaveBeenCalled())
    expect(onSubmit).toHaveBeenCalledWith({ role: 'mama', name: 'Лена', email: 'mama@example.com', consent: true, code: '123456' })
  })

  it('сервер потребовал согласие: возвращает к данным с понятным текстом', () => {
    expect(describeSignupError(new ApiError(400, 'consent_required'))).toEqual({ text: 'Нужно согласие на обработку персональных данных.', backToDetails: true })
  })
})

describe('экран согласия для прежних участников', () => {
  // оболочка берёт профиль через RTK Query (настоящий fetch): подставляем ответ /api/me, остальное отвечает ошибкой
  function renderShell(consentRequired: boolean) {
    const overview = { member: { ...base, email: 'l@x.y', consentRequired }, family: { code: 'c' }, members: [base] }
    vi.stubGlobal('fetch', async (input: string) => (String(input) === '/api/me' ? new Response(JSON.stringify(overview), { status: 200 }) : new Response('{}', { status: 500 })))
    setSession({ token: 'tok', memberId: 'me' })
    vi.mocked(api.listChats).mockResolvedValue({ chats: [] })
    return render(
      <Provider store={makeStore({ hydrate: false })}>
        <IdentityContext.Provider value={{ identity, save: async () => {}, clear: async () => {} }}>
          <MemoryRouter initialEntries={['/my-day']}>
            <Routes>
              <Route element={<AppShell />}>
                <Route path="/my-day" element={<p>Мой день</p>} />
              </Route>
            </Routes>
          </MemoryRouter>
        </IdentityContext.Provider>
      </Provider>,
    )
  }

  it('пока согласия нет, вместо приложения экран согласия', async () => {
    renderShell(true)
    expect(await screen.findByRole('heading', { name: 'Согласие на обработку данных' })).toBeInTheDocument()
    expect(screen.queryByText('Мой день', { selector: 'p' })).not.toBeInTheDocument()
  })

  it('есть согласие: приложение открывается как обычно', async () => {
    renderShell(false)
    expect(await screen.findByText('Мой день', { selector: 'p' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Согласие на обработку данных' })).not.toBeInTheDocument()
  })

  function renderGate(clear = vi.fn(async () => {})) {
    render(
      <Provider store={makeStore({ hydrate: false })}>
        <IdentityContext.Provider value={{ identity, save: async () => {}, clear }}>
          <MemoryRouter>
            <ConsentGate />
          </MemoryRouter>
        </IdentityContext.Provider>
      </Provider>,
    )
    return clear
  }

  it('«Согласен, продолжить» доступна только с галочкой и отправляет согласие', async () => {
    renderGate()
    const button = screen.getByRole('button', { name: 'Согласен, продолжить' })
    expect(button).toBeDisabled()
    fireEvent.click(screen.getByRole('checkbox'))
    expect(button).toBeEnabled()
    fireEvent.click(button)
    await waitFor(() => expect(api.acceptConsent).toHaveBeenCalledWith('tok'))
  })

  it('сбой сохранения показан, повторить можно', async () => {
    vi.mocked(api.acceptConsent).mockRejectedValueOnce(new Error('boom'))
    renderGate()
    fireEvent.click(screen.getByRole('checkbox'))
    click('Согласен, продолжить')
    expect(await screen.findByText('Не удалось сохранить согласие. Попробуйте ещё раз.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Согласен, продолжить' })).toBeEnabled()
  })

  it('«Выйти» выходит из аккаунта', () => {
    const clear = renderGate()
    click('Выйти')
    expect(clear).toHaveBeenCalled()
  })
})

describe('страницы политики и соглашения', () => {
  it('политика: оператор, перечень обработчиков, трансграничная передача, раздел согласия', () => {
    render(<MemoryRouter><Privacy /></MemoryRouter>)
    expect(screen.getByRole('heading', { name: 'Политика обработки персональных данных' })).toBeInTheDocument()
    expect(screen.getAllByText(new RegExp(OPERATOR.name)).length).toBeGreaterThan(0)
    expect(document.getElementById('consent')).toBeInTheDocument()
    const text = document.body.textContent ?? ''
    for (const word of ['SMS Aero', 'SmartCaptcha', 'Firebase', 'трансграничной', 'несовершеннолетних', '152-ФЗ', 'отозвать']) expect(text).toContain(word)
  })

  it('соглашение ведёт на политику', () => {
    render(<MemoryRouter><Terms /></MemoryRouter>)
    expect(screen.getByRole('heading', { name: 'Пользовательское соглашение' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Политике обработки персональных данных' })).toHaveAttribute('href', '/privacy')
  })

  it('в профиле ссылки на политику и соглашение', () => {
    render(
      <Provider store={makeStore({ hydrate: false })}>
        <IdentityContext.Provider value={{ identity, save: async () => {}, clear: async () => {} }}>
          <ProfileContext.Provider value={{ data: { me: { ...base, email: 'l@x.y' }, members: [base] }, failed: false }}>
            <ConfirmProvider>
              <MemoryRouter><Profile /></MemoryRouter>
            </ConfirmProvider>
          </ProfileContext.Provider>
        </IdentityContext.Provider>
      </Provider>,
    )
    expect(screen.getByRole('link', { name: 'Политика обработки данных' })).toHaveAttribute('href', '/privacy')
    expect(screen.getByRole('link', { name: 'Пользовательское соглашение' })).toHaveAttribute('href', '/terms')
  })
})
