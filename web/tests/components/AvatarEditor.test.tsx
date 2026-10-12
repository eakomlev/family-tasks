import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/api'
import { AvatarEditor } from '@/pages/ProfileEdit/components/AvatarEditor'
import { describePhotoError } from '@/pages/ProfileEdit/utils'

const base = { name: 'Миша', seed: 'm1', busy: false, onPick: vi.fn(), onRemove: vi.fn() }

describe('AvatarEditor: аватар из Roblox', () => {
  it('у взрослых кнопки нет', () => {
    render(<AvatarEditor {...base} />)
    expect(screen.queryByRole('button', { name: /Roblox/ })).not.toBeInTheDocument()
  })

  it('ребёнок вводит ник и забирает аватар; форма закрывается', async () => {
    const onRoblox = vi.fn().mockResolvedValue(undefined)
    const user = userEvent.setup()
    render(<AvatarEditor {...base} onRoblox={onRoblox} />)
    await user.click(screen.getByRole('button', { name: 'Аватар из Roblox' }))
    expect(screen.getByRole('button', { name: 'Взять аватар' })).toBeDisabled()
    await user.type(screen.getByLabelText('Ник в Roblox'), ' Kid_1 ')
    await user.click(screen.getByRole('button', { name: 'Взять аватар' }))
    expect(onRoblox).toHaveBeenCalledWith('Kid_1')
    await waitFor(() => expect(screen.queryByLabelText('Ник в Roblox')).not.toBeInTheDocument())
  })

  it('при ошибке форма остаётся открытой с введённым ником', async () => {
    const onRoblox = vi.fn().mockRejectedValue(new Error('нет'))
    const user = userEvent.setup()
    render(<AvatarEditor {...base} onRoblox={onRoblox} />)
    await user.click(screen.getByRole('button', { name: 'Аватар из Roblox' }))
    await user.type(screen.getByLabelText('Ник в Roblox'), 'Kid_1')
    await user.click(screen.getByRole('button', { name: 'Взять аватар' }))
    await waitFor(() => expect(onRoblox).toHaveBeenCalled())
    expect(screen.getByLabelText('Ник в Roblox')).toHaveValue('Kid_1')
  })
})

describe('describePhotoError: Roblox', () => {
  it('понятные тексты для ошибок сервера', () => {
    expect(describePhotoError(new ApiError(404, 'roblox_user_not_found'))).toMatch(/нет/)
    expect(describePhotoError(new ApiError(502, 'roblox_unavailable'))).toMatch(/Roblox/)
  })
})
