import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as api from '@/api'
import { InviteByEmail } from '@/pages/Invite/components/InviteByEmail'
import { contactPickerSupported, pickContacts } from '@/lib/contacts'
import { describeInviteEmailError } from '@/lib/errors'
import { RoleForm } from '@/components/RoleForm'
import { JOIN_ROLES } from '@/lib/roles'

vi.mock('@/api', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/api')>()), inviteByEmail: vi.fn(), requestEmailCode: vi.fn() }))

beforeEach(() => {
  vi.mocked(api.inviteByEmail).mockReset().mockResolvedValue(undefined)
})
afterEach(() => {
  cleanup()
  delete (navigator as { contacts?: unknown }).contacts
  delete (window as { ContactsManager?: unknown }).ContactsManager
})

const renderIt = () => render(<MemoryRouter><InviteByEmail token="tok" /></MemoryRouter>)
const add = async (email: string) => {
  await userEvent.type(screen.getByLabelText('Email приглашаемого'), email)
  await userEvent.click(screen.getByRole('button', { name: 'Добавить' }))
}

describe('приглашение по email', () => {
  it('адрес добавляется в список и уходит письмом; результат виден у адреса', async () => {
    renderIt()
    await add(' Guest@Example.com ')
    expect(screen.getByText('guest@example.com')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Отправить приглашение' }))
    await waitFor(() => expect(api.inviteByEmail).toHaveBeenCalledWith('tok', 'guest@example.com'))
    expect(await screen.findByText('Отправлено')).toBeInTheDocument()
    // отправленное из очереди на отправку ушло
    expect(screen.queryByRole('button', { name: /Отправить приглашени/ })).not.toBeInTheDocument()
  })

  it('неверный адрес не добавляется, повтор адреса не дублируется', async () => {
    renderIt()
    await add('не-адрес')
    expect(screen.getByText(/Не похоже на email/)).toBeInTheDocument()
    expect(screen.queryByRole('list', { name: 'Кого пригласить' })).not.toBeInTheDocument()
    await userEvent.clear(screen.getByLabelText('Email приглашаемого'))
    await add('a@b.co')
    await add('A@B.co')
    expect(within(screen.getByRole('list', { name: 'Кого пригласить' })).getAllByRole('listitem')).toHaveLength(1)
  })

  it('несколько адресов: письма по одному, у отказа своя причина и адрес остаётся для повтора', async () => {
    vi.mocked(api.inviteByEmail).mockImplementation(async (_token, email) => {
      if (email === 'in@family.co') throw new api.ApiError(409, 'already_member')
    })
    renderIt()
    await add('new@x.co')
    await add('in@family.co')
    await userEvent.click(screen.getByRole('button', { name: 'Отправить приглашения: 2' }))
    expect(await screen.findByText('Уже в семье')).toBeInTheDocument()
    expect(screen.getByText('Отправлено')).toBeInTheDocument()
    // остался один адрес, его можно убрать
    expect(screen.getByRole('button', { name: 'Отправить приглашение' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Убрать in@family.co' }))
    expect(screen.queryByText('in@family.co')).not.toBeInTheDocument()
  })

  it('кнопки «Выбрать из контактов» нет, если браузер не умеет', () => {
    renderIt()
    expect(screen.queryByRole('button', { name: 'Выбрать из контактов' })).not.toBeInTheDocument()
  })

  it('из контактов: выбранные адреса попадают в список вместе с именами', async () => {
    const select = vi.fn(async () => [
      { name: ['Бабушка Нина'], email: ['nina@mail.co'] },
      { name: ['Без почты'], email: [] },
      { name: [], email: ['one@mail.co', 'two@mail.co'] },
    ])
    Object.assign(navigator, { contacts: { select } })
    Object.assign(window, { ContactsManager: class {} })
    renderIt()
    await userEvent.click(screen.getByRole('button', { name: 'Выбрать из контактов' }))
    expect(select).toHaveBeenCalledWith(['name', 'email'], { multiple: true })
    expect(await screen.findByText('Бабушка Нина')).toBeInTheDocument()
    expect(screen.getByText('nina@mail.co')).toBeInTheDocument()
    expect(screen.getByText('one@mail.co')).toBeInTheDocument()
    expect(screen.getByText('two@mail.co')).toBeInTheDocument()
    expect(screen.queryByText('Без почты')).not.toBeInTheDocument()
  })
})

describe('контакты и тексты ошибок', () => {
  it('закрытое окно выбора даёт пустой список, не ошибку; без поддержки пусто', async () => {
    expect(contactPickerSupported()).toBe(false)
    expect(await pickContacts()).toEqual([])
    Object.assign(navigator, { contacts: { select: vi.fn(async () => { throw Object.assign(new Error('x'), { name: 'AbortError' }) }) } })
    expect(await pickContacts()).toEqual([])
  })

  it('причины отказа понятны', () => {
    const text = (status: number, code: string) => describeInviteEmailError(new api.ApiError(status, code))
    expect(text(409, 'already_member')).toBe('Уже в семье')
    expect(text(409, 'family_full')).toMatch(/6 участников/)
    expect(text(429, 'too_soon')).toMatch(/10 минут/)
    expect(text(429, 'invite_limit')).toMatch(/слишком много/)
    expect(text(500, 'internal_error')).toBe('Не удалось отправить')
  })
})

describe('присоединение по письму', () => {
  it('адрес из ссылки подставлен в поле email', () => {
    render(<RoleForm roles={JOIN_ROLES} submitLabel="Присоединиться" initialEmail="guest@mail.co" onSubmit={async () => {}} />)
    expect(screen.getByLabelText(/^Email/)).toHaveValue('guest@mail.co')
  })
})
