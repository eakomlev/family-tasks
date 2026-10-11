import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Splash } from '@/components/Splash'

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('Splash', () => {
  it('сначала просто «Загрузка…», без кнопки сброса', () => {
    render(<Splash />)
    expect(screen.getByRole('status')).toHaveTextContent('Загрузка…')
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('если загрузка затянулась, предлагает сброс', () => {
    render(<Splash />)
    act(() => void vi.advanceTimersByTime(8100))
    expect(screen.getByText(/Загрузка затянулась/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Сбросить и перезагрузить' })).toBeInTheDocument()
  })
})
