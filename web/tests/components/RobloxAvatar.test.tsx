import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Provider } from 'react-redux'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as api from '@/api'
import type { Member } from '@/api'
import { IdentityContext } from '@/identity/context'
import { dataUrlToFile, ImageError } from '@/lib/image'
import ProfileEdit from '@/pages/ProfileEdit'
import { ProfileContext } from '@/profile/context'
import { makeStore } from '@/store'
import { setSession } from '@/store/session'

vi.mock('@/api', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/api')>()), getRobloxAvatar: vi.fn(), updateProfile: vi.fn() }))
// сжатие картинки в canvas в jsdom недоступно: подменяем, но проверяем, что ему передали настоящий файл
vi.mock('@/lib/image', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/lib/image')>()), resizeToAvatar: vi.fn() }))

const PNG_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='
const kid: Member = { id: 'kid', name: 'Роман', role: 'child', avatar: null, isOwner: false }

describe('dataUrlToFile', () => {
  it('разбирает base64 в настоящий файл нужного типа без сети', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    const file = dataUrlToFile(`data:image/png;base64,${PNG_BASE64}`, 'roblox.png')
    expect(file.name).toBe('roblox.png')
    expect(file.type).toBe('image/png')
    const bytes = new Uint8Array(await file.arrayBuffer())
    expect([...bytes.subarray(1, 4)]).toEqual([0x50, 0x4e, 0x47])
    expect(file.size).toBe(atob(PNG_BASE64).length)
    expect(fetchSpy).not.toHaveBeenCalled()
    vi.unstubAllGlobals()
  })

  it('не data URL: понятная ошибка', () => {
    expect(() => dataUrlToFile('https://example.com/a.png', 'x.png')).toThrow(ImageError)
  })
})

describe('«Аватар из Roblox» на странице изменения профиля', () => {
  beforeEach(() => {
    setSession({ token: 'tok', memberId: 'kid' })
    vi.mocked(api.getRobloxAvatar).mockReset().mockResolvedValue({ image: `data:image/png;base64,${PNG_BASE64}` })
    vi.mocked(api.updateProfile).mockReset().mockResolvedValue({ member: { ...kid, email: 'x@y.z' } })
  })

  it('картинка из ответа сервера превращается в файл без fetch (CSP запрещает fetch по data:) и сохраняется в профиль', async () => {
    const { resizeToAvatar } = await import('@/lib/image')
    vi.mocked(resizeToAvatar).mockResolvedValue('data:image/jpeg;base64,AAAA')
    const fetchSpy = vi.fn(async () => new Response('{}', { status: 500 }))
    vi.stubGlobal('fetch', fetchSpy)

    const identity = { familyCode: 'c', memberId: 'kid', name: 'Роман', role: 'child' as const, token: 'tok' }
    render(
      <Provider store={makeStore({ hydrate: false })}>
        <IdentityContext.Provider value={{ identity, save: async () => {}, clear: async () => {} }}>
          <ProfileContext.Provider value={{ data: { me: { ...kid, email: 'x@y.z', coins: 500 }, members: [kid] }, failed: false }}>
            <MemoryRouter><ProfileEdit /></MemoryRouter>
          </ProfileContext.Provider>
        </IdentityContext.Provider>
      </Provider>,
    )
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Аватар из Roblox' }))
    await user.type(screen.getByLabelText('Ник в Roblox'), 'Shmups123')
    await user.click(screen.getByRole('button', { name: 'Взять аватар' }))

    await waitFor(() => expect(api.updateProfile).toHaveBeenCalledWith('tok', { avatar: 'data:image/jpeg;base64,AAAA' }))
    const file = vi.mocked(resizeToAvatar).mock.calls[0][0] as File
    expect(file.type).toBe('image/png')
    expect(file.size).toBeGreaterThan(0)
    expect(screen.queryByText(/Не удалось сохранить фото/)).not.toBeInTheDocument()
    expect(fetchSpy).not.toHaveBeenCalledWith(expect.stringMatching(/^data:/))
    vi.unstubAllGlobals()
  })
})
